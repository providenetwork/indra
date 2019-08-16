import {
  convert,
  NodeChannel,
  RegisteredAppDetails,
  SimpleSwapAppStateBigNumber,
  SwapParameters,
} from "@connext/types";
import { AppInstanceJson, Node as NodeTypes } from "@counterfactual/types";
import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify, formatEther, parseEther } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { delay, freeBalanceAddressFromXpub } from "../lib/utils";
import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export const calculateExchange = (amount: BigNumber, swapRate: string): BigNumber => {
  return bigNumberify(formatEther(amount.mul(parseEther(swapRate))).replace(/\.[0-9]*$/, ""));
};

export class SwapController extends AbstractController {
  private appId: string;
  private timeout: NodeJS.Timeout;

  public async swap(params: SwapParameters): Promise<NodeChannel> {
    // convert params + validate
    const { amount, toAssetId, fromAssetId, swapRate } = convert.SwapParameters(
      "bignumber",
      params,
    );

    const invalid = await this.validate(amount, toAssetId, fromAssetId, swapRate);
    if (invalid) {
      throw new Error(invalid.toString());
    }

    // For below sanity check
    const preSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const preSwapToBal = await this.connext.getFreeBalance(toAssetId);

    // get app definition from constants
    const appInfo = this.connext.getRegisteredAppDetails("SimpleTwoPartySwapApp");

    // FIXME: when you dont have the looping, you try to uninstall before the
    // app is returned from `getAppInstances` (even though it is already
    // installed?) so thats not that tight
    const preInstallApps = (await this.connext.getAppInstances()).length;

    // install the swap app
    await this.swapAppInstall(amount, toAssetId, fromAssetId, swapRate, appInfo);

    this.log.info(`Swap app installed! Uninstalling without updating state.`);

    // FIXME: remove!
    while ((await this.connext.getAppInstances()).length <= preInstallApps) {
      this.log.info(
        `still could not pick up any newly installed apps after ` +
          `installing swap. waiting 1s and trying again...`,
      );
      await delay(1000);
    }

    // TODO: should we check if its the right app?
    this.log.info(`Found installed app in app instances, attempting to uninstall..`);

    // if app installed, that means swap was accepted
    // now uninstall
    await this.swapAppUninstall(this.appId);

    // Sanity check to ensure swap was executed correctly
    const postSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const postSwapToBal = await this.connext.getFreeBalance(toAssetId);
    // balance decreases
    const diffFrom = preSwapFromBal[this.connext.freeBalanceAddress].sub(
      postSwapFromBal[this.connext.freeBalanceAddress],
    );
    // balance increases
    const diffTo = postSwapToBal[this.connext.freeBalanceAddress].sub(
      preSwapToBal[this.connext.freeBalanceAddress],
    );
    const swappedAmount = calculateExchange(amount, swapRate);
    if (!diffFrom.eq(amount) || !diffTo.eq(swappedAmount)) {
      throw new Error("Invalid final swap amounts - this shouldn't happen!!");
    }
    const newState = await this.connext.getChannel();

    // TODO: fix the state / types!!
    return newState as NodeChannel;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS
  private validate = async (
    amount: BigNumber,
    toAssetId: string,
    fromAssetId: string,
    swapRate: string,
  ): Promise<undefined | string> => {
    // check that there is sufficient free balance for amount
    const preSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const userBal = preSwapFromBal[this.connext.freeBalanceAddress];
    const preSwapToBal = await this.connext.getFreeBalance(toAssetId);
    const nodeBal = preSwapToBal[freeBalanceAddressFromXpub(this.connext.nodePublicIdentifier)];
    const swappedAmount = calculateExchange(amount, swapRate);
    const errs = [
      invalidAddress(fromAssetId),
      invalidAddress(toAssetId),
      notLessThanOrEqualTo(amount, userBal),
      notLessThanOrEqualTo(swappedAmount, nodeBal),
      notPositive(parseEther(swapRate)),
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  // TODO: fix type of data
  private resolveInstallSwap = (res: (value?: unknown) => void, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    res(data);
    return data;
  };

  // TODO: fix types of data
  private rejectInstallSwap = (rej: any, msg: any): any => {
    // check app id
    if (this.appId !== msg.data.appInstanceId) {
      return;
    }

    rej(`Install rejected. Event data: ${JSON.stringify(msg.data, null, 2)}`);
    return msg.data;
  };

  // TODO: fix for virtual exchanges!
  private swapAppInstall = async (
    amount: BigNumber,
    toAssetId: string,
    fromAssetId: string,
    swapRate: string,
    appInfo: RegisteredAppDetails,
  ): Promise<any> => {
    let boundResolve;
    let boundReject;

    const swappedAmount = calculateExchange(amount, swapRate);

    this.log.info(
      `Installing swap app. Swapping ${amount.toString()} of ${fromAssetId}` +
        ` for ${swappedAmount.toString()} of ${toAssetId}`,
    );

    // TODO: is this the right state and typing?? In contract tests, uses
    // something completely different

    // NOTE: always put the initiators swap information FIRST
    // followed by responders. If this is not included, the swap will
    // fail, causing the balances to be indexed on the wrong token
    // address key in `get-outcome-increments.ts` in cf code base
    // ideally this would be fixed at some point
    const initialState: SimpleSwapAppStateBigNumber = {
      coinTransfers: [
        [
          {
            amount,
            to: fromExtendedKey(this.connext.publicIdentifier).derivePath("0").address,
          },
        ],
        [
          {
            amount: swappedAmount,
            to: fromExtendedKey(this.connext.nodePublicIdentifier).derivePath("0").address,
          },
        ],
      ],
    };

    const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding } = appInfo;

    const params: NodeTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount, // TODO will this work?
      initiatorDepositTokenAddress: fromAssetId,
      outcomeType: appInfo.outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: swappedAmount, // TODO will this work? ERC20 context?
      responderDepositTokenAddress: toAssetId,
      timeout: Zero,
    };

    const res = await this.connext.proposeInstallApp(params);

    // set app instance id
    this.appId = res.appInstanceId;

    await new Promise((res: any, rej: any): any => {
      boundReject = this.rejectInstallSwap.bind(null, rej);
      boundResolve = this.resolveInstallSwap.bind(null, res);
      this.listener.on(NodeTypes.EventName.INSTALL, boundResolve);
      this.listener.on(NodeTypes.EventName.REJECT_INSTALL, boundReject);
      // this.timeout = setTimeout(() => {
      //   this.log.info("Install swap app timed out, rejecting install.")
      //   this.cleanupInstallListeners(boundResolve, boundReject);
      //   boundReject({ data: { appInstanceId: this.appId } });
      // }, 5000);
    });

    this.cleanupInstallListeners(boundResolve, boundReject);
    return res.appInstanceId;
  };

  private cleanupInstallListeners = (boundResolve: any, boundReject: any): void => {
    this.listener.removeListener(NodeTypes.EventName.INSTALL, boundResolve);
    this.listener.removeListener(NodeTypes.EventName.REJECT_INSTALL, boundReject);
  };

  private swapAppUninstall = async (appId: string): Promise<void> => {
    await this.connext.uninstallApp(appId);
    // TODO: cf does not emit uninstall event on the node
    // that has called this function but ALSO does not immediately
    // uninstall the apps. This will be a problem when trying to
    // display balances...

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    await new Promise(
      async (res: any, rej: any): Promise<any> => {
        const getAppIds = async (): Promise<string[]> => {
          return (await this.connext.getAppInstances()).map((a: AppInstanceJson) => a.identityHash);
        };
        let retries = 0;
        while ((await getAppIds()).indexOf(this.appId) !== -1 && retries <= 5) {
          this.log.info("found app id in the open apps... retrying...");
          await delay(500);
          retries = retries + 1;
        }

        if (retries > 5) rej();

        res();
      },
    );
  };
}
