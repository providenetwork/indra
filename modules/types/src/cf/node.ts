import { BigNumber, BigNumberish } from "ethers/utils";

import { AppABIEncodings, AppInstanceJson, AppInstanceProposal, OutcomeType, StateChannelJSON } from "./data-types";
import { SolidityValueType } from "./simple-types";

type JsonRpcProtocolV2 = {
  jsonrpc: "2.0";
};

type RpcParameters =
  | {
      [key: string]: any;
    }
  | any[];

export type JsonRpcNotification = JsonRpcProtocolV2 & {
  result: any;
};

export type JsonRpcResponse = JsonRpcNotification & {
  id: number;
};

export type Rpc = {
  methodName: string;
  parameters: RpcParameters;
  id?: number;
};

export interface IRpcNodeProvider {
  onMessage(callback: (message: JsonRpcResponse | JsonRpcNotification) => void): any;
  sendMessage(message: Rpc): any;
}

export namespace CFCoreTypes {
  /**
   * The message type for Nodes to communicate with each other.
   */
  export type NodeMessage = {
    from: string;
    type: EventName;
  };

  // This is used instead of the ethers `Transaction` because that type
  // requires the nonce and chain ID to be specified, when sometimes those
  // arguments are not known at the time of creating a transaction.
  export type MinimalTransaction = {
    to: string;
    value: BigNumberish;
    data: string;
  };

  export interface ServiceFactory {
    connect?(host: string, port: string): ServiceFactory;
    auth?(email: string, password: string): Promise<void>;
    createMessagingService?(messagingServiceKey: string): IMessagingService;
    createStoreService?(storeServiceKey: string): IStoreService;
  }

  export interface IMessagingService {
    send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void>;
    onReceive(address: string, callback: (msg: CFCoreTypes.NodeMessage) => void): any;
  }

  /**
   * An interface for a stateful storage service with an API very similar to Firebase's API.
   * Values are addressed by paths, which are separated by the forward slash separator `/`.
   * `get` must return values whose paths have prefixes that match the provided path,
   * keyed by the remaining path.
   * `set` allows multiple values and paths to be atomically set. In Firebase, passing `null`
   * as `value` deletes the entry at the given prefix, and passing objects with null subvalues
   * deletes entries at the path extended by the subvalue's path within the object. `set` must
   * have the same behaviour if the `allowDelete` flag is passed; otherwise, any null values or
   * subvalues throws an error.
   */
  export interface IStoreService {
    get(path: string): Promise<any>;
    set(pairs: { path: string; value: any }[], allowDelete?: Boolean): Promise<void>;
    reset?(): Promise<void>;
  }

  export interface IPrivateKeyGenerator {
    (s: string): Promise<string>;
  }

  /**
   * Centralized locking service (i.e. redis)
   */
  export interface ILockService {
    acquireLock(
      lockName: string,
      callback: (...args: any[]) => any,
      timeout: number
    ): Promise<any>;
  }

  export enum ErrorType {
    ERROR = "error"
  }

  // SOURCE: https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#public-methods
  export enum MethodName {
    ACCEPT_STATE = "acceptState",
    GET_PROPOSED_APP_INSTANCE = "getProposedAppInstance"
  }

  export const RpcMethodNames = {
    chan_create: "chan_create",
    chan_deposit: "chan_deposit",
    chan_deployStateDepositHolder: "chan_deployStateDepositHolder",
    chan_getChannelAddresses: "chan_getChannelAddresses",
    chan_getAppInstance: "chan_getAppInstance",
    chan_getAppInstances: "chan_getAppInstances",
    chan_getStateDepositHolderAddress: "chan_getStateDepositHolderAddress",
    chan_getFreeBalanceState: "chan_getFreeBalanceState",
    chan_getTokenIndexedFreeBalanceStates:
      "chan_getTokenIndexedFreeBalanceStates",
    chan_getProposedAppInstances: "chan_getProposedAppInstances",
    chan_getState: "chan_getState",
    chan_getStateChannel: "chan_getStateChannel",
    chan_install: "chan_install",
    chan_requestDepositRights: "chan_requestDepositRights",
    chan_installVirtual: "chan_installVirtual",
    chan_proposeInstall: "chan_proposeInstall",
    chan_rejectInstall: "chan_rejectInstall",
    chan_updateState: "chan_updateState",
    chan_takeAction: "chan_takeAction",
    chan_uninstall: "chan_uninstall",
    chan_uninstallVirtual: "chan_uninstallVirtual",
    chan_rescindDepositRights: "chan_rescindDepositRights",
    chan_withdraw: "chan_withdraw",
    chan_withdrawCommitment: "chan_withdrawCommitment"
  };
  export type RpcMethodName = keyof typeof RpcMethodNames;

  // SOURCE: https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#events
  export const EventNames = {
    CREATE_CHANNEL_EVENT: "CREATE_CHANNEL_EVENT",
    DEPOSIT_CONFIRMED_EVENT: "DEPOSIT_CONFIRMED_EVENT",
    DEPOSIT_FAILED_EVENT: "DEPOSIT_FAILED_EVENT",
    DEPOSIT_STARTED_EVENT: "DEPOSIT_STARTED_EVENT",
    INSTALL_EVENT: "INSTALL_EVENT",
    INSTALL_VIRTUAL_EVENT: "INSTALL_VIRTUAL_EVENT",
    REJECT_INSTALL_EVENT: "REJECT_INSTALL_EVENT",
    UNINSTALL_EVENT: "UNINSTALL_EVENT",
    UNINSTALL_VIRTUAL_EVENT: "UNINSTALL_VIRTUAL_EVENT",
    UPDATE_STATE_EVENT: "UPDATE_STATE_EVENT",
    WITHDRAWAL_CONFIRMED_EVENT: "WITHDRAWAL_CONFIRMED_EVENT",
    WITHDRAWAL_FAILED_EVENT: "WITHDRAWAL_FAILED_EVENT",
    WITHDRAWAL_STARTED_EVENT: "WITHDRAWAL_STARTED_EVENT",
    PROPOSE_INSTALL_EVENT: "PROPOSE_INSTALL_EVENT",
    PROTOCOL_MESSAGE_EVENT: "PROTOCOL_MESSAGE_EVENT"
  };
  export type EventName = keyof typeof EventNames;

  export type CreateChannelParams = {
    owners: string[];
  };

  export type CreateChannelResult = {
    multisigAddress: string;
    owners: string[];
    counterpartyXpub: string;
  };

  export type CreateChannelTransactionResult = {
    multisigAddress: string;
  };

  export type CreateMultisigParams = {
    owners: string[];
  };

  export type CreateMultisigResult = {
    multisigAddress: string;
  };

  export type DeployStateDepositHolderParams = {
    multisigAddress: string;
    retryCount?: number;
  };

  export type DeployStateDepositHolderResult = {
    transactionHash: string;
  };

  export type DepositParams = {
    multisigAddress: string;
    amount: BigNumber;
    tokenAddress?: string;
  };

  export type DepositResult = {
    multisigBalance: BigNumber;
    tokenAddress: string;
  };

  export type RequestDepositRightsResult = {
    freeBalance: {
      [s: string]: BigNumber;
    };
    recipient: string;
    tokenAddress: string;
  };

  export type GetAppInstanceDetailsParams = {
    appInstanceId: string;
  };

  export type GetAppInstanceDetailsResult = {
    appInstance: AppInstanceJson;
  };

  export type GetStateDepositHolderAddressParams = {
    owners: string[];
  };

  export type GetStateDepositHolderAddressResult = {
    address: string;
  };

  export type GetAppInstancesParams = {
    multisigAddress?: string;
  };

  export type GetAppInstancesResult = {
    appInstances: AppInstanceJson[];
  };

  export type GetChannelAddressesParams = {};

  export type GetChannelAddressesResult = {
    multisigAddresses: string[];
  };

  export type GetFreeBalanceStateParams = {
    multisigAddress: string;
    tokenAddress?: string;
  };

  export type GetFreeBalanceStateResult = {
    [s: string]: BigNumber;
  };

  export type GetTokenIndexedFreeBalanceStatesParams = {
    multisigAddress: string;
  };

  export type GetTokenIndexedFreeBalanceStatesResult = {
    [tokenAddress: string]: {
      [s: string]: BigNumber;
    };
  };

  export type GetProposedAppInstancesParams = {
    multisigAddress?: string;
  };

  export type GetProposedAppInstancesResult = {
    appInstances: AppInstanceProposal[];
  };

  export type GetProposedAppInstanceParams = {
    appInstanceId: string;
  };

  export type GetProposedAppInstanceResult = {
    appInstance: AppInstanceProposal;
  };

  export type GetStateParams = {
    appInstanceId: string;
  };

  export type GetStateResult = {
    state: SolidityValueType;
  };

  export type GetStateChannelParams = {
    multisigAddress: string;
  };

  export type GetStateChannelResult = {
    data: StateChannelJSON;
  };

  export type InstallParams = {
    appInstanceId: string;
  };

  export type RequestDepositRightsParams = {
    multisigAddress: string;
    tokenAddress?: string;
  };

  export type InstallResult = {
    appInstance: AppInstanceJson;
  };

  export type InstallVirtualParams = InstallParams & {
    intermediaryIdentifier: string;
  };

  export type InstallVirtualResult = InstallResult;

  export type ProposeInstallParams = {
    appDefinition: string;
    abiEncodings: AppABIEncodings;
    initiatorDeposit: BigNumber;
    initiatorDepositTokenAddress?: string;
    responderDeposit: BigNumber;
    responderDepositTokenAddress?: string;
    timeout: BigNumber;
    initialState: SolidityValueType;
    proposedToIdentifier: string;
    outcomeType: OutcomeType;
    meta?: Object;
  };

  export type ProposeInstallVirtualParams = ProposeInstallParams & {
    intermediaryIdentifier: string;
  };

  export type ProposeInstallVirtualResult = ProposeInstallResult;

  export type ProposeInstallResult = {
    appInstanceId: string;
  };

  export type RejectInstallParams = {
    appInstanceId: string;
  };

  export type RejectInstallResult = {};

  export type TakeActionParams = {
    appInstanceId: string;
    action: SolidityValueType;
  };

  export type TakeActionResult = {
    newState: SolidityValueType;
  };

  export type UninstallParams = {
    appInstanceId: string;
  };

  export type RescindDepositRightsParams = {
    multisigAddress: string;
    tokenAddress?: string;
  };

  export type UninstallResult = {};

  export type UninstallVirtualParams = UninstallParams & {
    intermediaryIdentifier: string;
  };

  export type UninstallVirtualResult = UninstallResult;

  export type UpdateStateParams = {
    appInstanceId: string;
    newState: SolidityValueType;
  };

  export type UpdateStateResult = {
    newState: SolidityValueType;
  };

  export type WithdrawParams = {
    multisigAddress: string;
    recipient?: string;
    amount: BigNumber;
    tokenAddress?: string;
  };

  export type WithdrawResult = {
    recipient: string;
    txHash: string;
  };

  export type WithdrawCommitmentParams = WithdrawParams;

  export type WithdrawCommitmentResult = {
    transaction: MinimalTransaction;
  };

  export type MethodParams =
    | GetAppInstancesParams
    | GetProposedAppInstancesParams
    | ProposeInstallParams
    | ProposeInstallVirtualParams
    | RejectInstallParams
    | InstallParams
    | InstallVirtualParams
    | GetStateParams
    | GetAppInstanceDetailsParams
    | TakeActionParams
    | UninstallParams
    | CreateChannelParams
    | GetChannelAddressesParams
    | DeployStateDepositHolderParams;
  export type MethodResult =
    | GetAppInstancesResult
    | GetProposedAppInstancesResult
    | ProposeInstallResult
    | ProposeInstallVirtualResult
    | RejectInstallResult
    | InstallResult
    | InstallVirtualResult
    | GetStateResult
    | GetAppInstanceDetailsResult
    | TakeActionResult
    | UninstallResult
    | CreateChannelResult
    | GetChannelAddressesResult
    | DeployStateDepositHolderResult;

  export type CreateMultisigEventData = {
    owners: string[];
    multisigAddress: string;
  };

  export type InstallEventData = {
    appInstanceId: string;
  };

  export type RejectInstallEventData = {
    appInstance: AppInstanceProposal;
  };

  export type UninstallEventData = {
    appInstanceId: string;
  };

  export type UpdateStateEventData = {
    appInstanceId: string;
    newState: SolidityValueType;
    action?: SolidityValueType;
  };

  export type WithdrawEventData = {
    amount: BigNumber;
  };

  export type EventData =
    | InstallEventData
    | RejectInstallEventData
    | UpdateStateEventData
    | UninstallEventData
    | CreateMultisigEventData;

  export type MethodMessage = {
    type: MethodName;
    requestId: string;
  };

  export type MethodRequest = MethodMessage & {
    params: MethodParams;
  };

  export type MethodResponse = MethodMessage & {
    result: MethodResult;
  };

  export type Event = {
    type: EventName;
    data: EventData;
  };

  export type Error = {
    type: ErrorType;
    requestId?: string;
    data: {
      errorName: string;
      message?: string;
      appInstanceId?: string;
      extra?: { [k: string]: string | number | boolean | object };
    };
  };

  export type Message = MethodRequest | MethodResponse | Event | Error;
}
