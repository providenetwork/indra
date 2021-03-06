import { Contract, providers } from "ethers";
import { BigNumber, Network } from "ethers/utils";

import {
  AppActionBigNumber,
  AppRegistry,
  AppState,
  DefaultApp,
  SupportedApplication,
  SupportedNetwork,
} from "./app";
import { ConnextEvent } from "./basic";
import { AppInstanceJson, CFCoreTypes } from "./cf";
import { CFCoreChannel, ChannelAppSequences, ChannelState, PaymentProfile } from "./channel";
import {
  ChannelProviderConfig,
  ChannelProviderRpcMethod,
  IChannelProvider,
  KeyGen,
  StorePair,
} from "./channelProvider";
import {
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  DepositParameters,
  RequestDepositRightsParameters,
  RescindDepositRightsParameters,
  RescindDepositRightsResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferResponse,
  SwapParameters,
  TransferParameters,
  WithdrawParameters,
} from "./inputs";
import { IMessagingService } from "./messaging";
import {
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  INodeApiClient,
  RequestCollateralResponse,
  Transfer,
} from "./node";

export type InternalClientOptions = ClientOptions & {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: GetConfigResponse;
  ethProvider: providers.JsonRpcProvider;
  messaging: IMessagingService;
  network: Network;
  node: INodeApiClient;
  store: Store;
  token: Contract;
};

export interface Store extends CFCoreTypes.IStoreService {
  set(pairs: StorePair[], shouldBackup?: Boolean): Promise<void>;
  restore(): Promise<StorePair[]>;
}

// channelProvider, mnemonic, and xpub+keyGen are all optional but one of them needs to be provided
export interface ClientOptions {
  ethProviderUrl: string;
  nodeUrl?: string; // ws:// or nats:// urls are supported
  channelProvider?: IChannelProvider;
  keyGen?: KeyGen;
  mnemonic?: string;
  xpub?: string;
  store?: Store;
  logLevel?: number;
}

export interface IConnextClient {
  ////////////////////////////////////////
  // Properties

  config: GetConfigResponse;
  freeBalanceAddress: string;
  multisigAddress: string;
  nodePublicIdentifier: string;
  publicIdentifier: string;
  signerAddress: string;
  channelProvider: IChannelProvider;

  ////////////////////////////////////////
  // Methods

  restart(): Promise<void>;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: ConnextEvent | ChannelProviderRpcMethod, callback: (...args: any[]) => void): void;
  once(event: ConnextEvent | ChannelProviderRpcMethod, callback: (...args: any[]) => void): void;
  emit(event: ConnextEvent | ChannelProviderRpcMethod, data: any): boolean;

  ///////////////////////////////////
  // CORE CHANNEL METHODS
  deposit(params: DepositParameters): Promise<ChannelState>;
  swap(params: SwapParameters): Promise<CFCoreChannel>;
  transfer(params: TransferParameters): Promise<ConditionalTransferResponse>;
  withdraw(params: WithdrawParameters): Promise<ChannelState>;
  resolveCondition(params: ResolveConditionParameters): Promise<ResolveConditionResponse>;
  conditionalTransfer(params: ConditionalTransferParameters): Promise<ConditionalTransferResponse>;
  restoreState(): Promise<void>;
  channelProviderConfig(): Promise<ChannelProviderConfig>;
  requestDepositRights(
    params: RequestDepositRightsParameters,
  ): Promise<CFCoreTypes.RequestDepositRightsResult>;
  rescindDepositRights(
    params: RescindDepositRightsParameters,
  ): Promise<RescindDepositRightsResponse>;
  checkDepositRights(params: CheckDepositRightsParameters): Promise<CheckDepositRightsResponse>;

  ///////////////////////////////////
  // NODE EASY ACCESS METHODS
  // TODO: do we really need to expose all of these?
  getChannel(): Promise<GetChannelResponse>;
  getLinkedTransfer(paymentId: string): Promise<Transfer>;
  getAppRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry>;
  getRegisteredAppDetails(appName: SupportedApplication): DefaultApp;
  createChannel(): Promise<CreateChannelResponse>;
  subscribeToSwapRates(from: string, to: string, callback: any): Promise<any>;
  getLatestSwapRate(from: string, to: string): Promise<string>;
  unsubscribeToSwapRates(from: string, to: string): Promise<void>;
  requestCollateral(tokenAddress: string): Promise<RequestCollateralResponse | void>;
  getPaymentProfile(assetId?: string): Promise<PaymentProfile | undefined>;
  getTransferHistory(): Promise<Transfer[]>;
  reclaimPendingAsyncTransfers(): Promise<void>;
  reclaimPendingAsyncTransfer(
    amount: string,
    assetId: string,
    paymentId: string,
    encryptedPreImage: string,
  ): Promise<ResolveLinkedTransferResponse>;
  verifyAppSequenceNumber(): Promise<ChannelAppSequences>;

  ///////////////////////////////////
  // CF MODULE EASY ACCESS METHODS
  deployMultisig(): Promise<CFCoreTypes.DeployStateDepositHolderResult>;
  getStateChannel(): Promise<CFCoreTypes.GetStateChannelResult>;
  providerDeposit(
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean,
  ): Promise<CFCoreTypes.DepositResult>;
  getFreeBalance(assetId?: string): Promise<CFCoreTypes.GetFreeBalanceStateResult>;
  getAppInstances(multisigAddress?: string): Promise<AppInstanceJson[]>;
  getAppInstanceDetails(appInstanceId: string): Promise<CFCoreTypes.GetAppInstanceDetailsResult>;
  getAppState(appInstanceId: string): Promise<CFCoreTypes.GetStateResult>;
  getProposedAppInstances(
    multisigAddress?: string,
  ): Promise<CFCoreTypes.GetProposedAppInstancesResult | undefined>;
  getProposedAppInstance(
    appInstanceId: string,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult | undefined>;
  proposeInstallApp(
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult>;
  installVirtualApp(appInstanceId: string): Promise<CFCoreTypes.InstallVirtualResult>;
  installApp(appInstanceId: string): Promise<CFCoreTypes.InstallResult>;
  rejectInstallApp(appInstanceId: string): Promise<CFCoreTypes.UninstallResult>;
  takeAction(
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<CFCoreTypes.TakeActionResult>;
  updateState(
    appInstanceId: string,
    newState: AppState | any,
  ): Promise<CFCoreTypes.UpdateStateResult>;
  uninstallApp(appInstanceId: string): Promise<CFCoreTypes.UninstallResult>;
  uninstallVirtualApp(appInstanceId: string): Promise<CFCoreTypes.UninstallVirtualResult>;
}
