import { RegisteredAppDetails, SupportedApplication } from "@connext/types";
import { AppInstanceInfo, AppInstanceJson } from "@counterfactual/types";
import { bigNumberify, getAddress } from "ethers/utils";

import { ConnextInternal } from "../connext";
import { freeBalanceAddressFromXpub } from "../lib/utils";

type ProposalValidator = {
  [index in SupportedApplication]: (
    app: AppInstanceInfo,
    registeredInfo: RegisteredAppDetails,
    isVirtual: boolean,
    connext: ConnextInternal,
  ) => Promise<string | undefined>;
};

export const validateSwapApp = async (
  app: AppInstanceInfo,
  registeredInfo: RegisteredAppDetails,
  isVirtual: boolean,
  connext: ConnextInternal,
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, isVirtual, connext);
  if (baseValidation) {
    return baseValidation;
  }

  // validate the timeout is above the minimum (?)

  // This is called as a default to the propose app install event
  // which does not have context into what *your* exchange rate is

  return undefined;
};

export const validateTransferApp = async (
  app: AppInstanceInfo,
  registeredInfo: RegisteredAppDetails,
  isVirtual: boolean,
  connext: ConnextInternal,
  // TODO: ideally this wouldnt get passed in, but you need it
  // to check things like your public identifier, open apps,
  // free balance, etc.
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, isVirtual, connext);
  if (baseValidation) {
    return baseValidation;
  }

  // check that the receivers deposit is 0
  // assume the recipient is always the responder
  if (!app.responderDeposit.isZero()) {
    return `Responder (payee) must have a zero balance in proposed app. Proposed app: ${prettyLog(
      app,
    )}`;
  }

  if (app.initiatorDeposit.isZero()) {
    return `Initiator (payor) must have nonzero balance in proposed app. Proposed app: ${prettyLog(
      app,
    )}`;
  }

  return undefined;
};

// TODO: implement
export const validateLinkedTransferApp = async (
  app: AppInstanceInfo,
  registeredInfo: RegisteredAppDetails,
  isVirtual: boolean,
  connext: ConnextInternal,
): Promise<string | undefined> => {
  return undefined;
};

export const appProposalValidation: ProposalValidator = {
  SimpleTwoPartySwapApp: validateSwapApp,
  UnidirectionalLinkedTransferApp: validateLinkedTransferApp,
  UnidirectionalTransferApp: validateTransferApp,
};

const prettyLog = (app: AppInstanceInfo) => {
  // convert any field thats a BN to a string
  const asStr = {};
  Object.entries(app).forEach(([name, value]) => {
    asStr[name] = value.toString();
  });
  return JSON.stringify(asStr, null, 2);
};

const baseAppValidation = async (
  app: AppInstanceInfo,
  registeredInfo: RegisteredAppDetails,
  isVirtual: boolean,
  connext: ConnextInternal,
): Promise<string | undefined> => {
  // check the initial state is consistent
  // FIXME: why isnt this in the cf types?
  console.log("******** app", JSON.stringify(app, null, 2));
  console.log("******** has initial state??", (app as any).initialState);
  // check that identity hash isnt used by another app
  const apps = await connext.getAppInstances();
  if (apps) {
    const sharedIds = (await connext.getAppInstances()).filter(
      (a: AppInstanceJson) => a.identityHash === app.identityHash,
    );
    if (sharedIds.length !== 0) {
      return `Duplicate app id detected. Proposed app: ${prettyLog(app)}`;
    }
  }

  // check that the app definition is the same
  if (app.appDefinition !== registeredInfo.appDefinitionAddress) {
    return `Incorrect app definition detected. Proposed app: ${prettyLog(app)}`;
  }

  // check that the encoding is the same
  if (app.abiEncodings.actionEncoding !== registeredInfo.actionEncoding) {
    return `Incorrect action encoding detected. Proposed app: ${prettyLog(app)}`;
  }

  if (app.abiEncodings.stateEncoding !== registeredInfo.stateEncoding) {
    return `Incorrect state encoding detected. Proposed app: ${prettyLog(app)}`;
  }

  // check that the outcome type is the same
  if (bigNumberify(app.initiatorDeposit).isZero() && bigNumberify(app.responderDeposit).isZero()) {
    return `Refusing to install app with two zero value deposits. Proposed app: ${prettyLog(app)}`;
  }

  // check that there is enough in the free balance of desired currency
  // to install app
  const responderFreeBalance = await connext.getFreeBalance(
    getAddress(app.responderDepositTokenAddress),
  );
  const userFreeBalance =
    responderFreeBalance[freeBalanceAddressFromXpub(connext.publicIdentifier)];
  if (userFreeBalance.lt(app.responderDeposit)) {
    return `Insufficient free balance for requested asset,
      freeBalance: ${userFreeBalance.toString()}
      required: ${app.responderDeposit}. Proposed app: ${prettyLog(app)}`;
  }

  // if it is a virtual app, check that the intermediary has sufficient
  // collateral in your channel
  const initiatorFreeBalance = await connext.getFreeBalance(
    getAddress(app.initiatorDepositTokenAddress),
  );
  const nodeFreeBalance =
    initiatorFreeBalance[freeBalanceAddressFromXpub(connext.nodePublicIdentifier)];
  if (isVirtual && nodeFreeBalance.lt(app.initiatorDeposit)) {
    return `Insufficient collateral for requested asset,
    freeBalance of node: ${nodeFreeBalance.toString()}
    required: ${app.initiatorDeposit}. Proposed app: ${prettyLog(app)}`;
  }

  // check that the intermediary includes your node if it is not an app with
  // your node
  const hasIntermediaries = app.intermediaries && app.intermediaries.length > 0;
  if (hasIntermediaries && !isVirtual) {
    return `Apps with connected node should have no intermediaries. Proposed app: ${prettyLog(
      app,
    )}`;
  }

  if (isVirtual && app.intermediaries.length < 1) {
    return `Virtual apps should have intermediaries. Proposed app: ${prettyLog(app)}`;
  }

  if (isVirtual) {
    const node = app.intermediaries.filter((intermediary: string) => {
      return intermediary === connext.nodePublicIdentifier;
    });
    if (node.length !== 1) {
      return `Connected node is not in proposed intermediaries. Proposed app: ${prettyLog(app)}`;
    }
  }

  return undefined;
};
