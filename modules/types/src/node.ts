import { TransactionResponse } from "ethers/providers";
import { BigNumber, Network, Transaction } from "ethers/utils";

import { AppRegistry, SupportedApplication, SupportedNetwork } from "./app";
import { CFCoreTypes, NetworkContext } from "./cf";
import { CFCoreChannel, ChannelAppSequences, PaymentProfile } from "./channel";
import { IChannelProvider } from "./channelProvider";
import { ResolveLinkedTransferResponse } from "./inputs";
import { IMessagingService, MessagingConfig } from "./messaging";

////////////////////////////////////
///////// NODE RESPONSE TYPES

export type ContractAddresses = NetworkContext & {
  Token: string;
  [SupportedApplication: string]: string;
};

export interface NodeConfig {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

export type Transfer<T = string> = {
  paymentId: string;
  amount: T;
  assetId: string;
  senderPublicIdentifier: string;
  receiverPublicIdentifier: string;
};
export type TransferBigNumber = Transfer<BigNumber>;

// nats stuff
type successResponse = {
  status: "success";
};

type errorResponse = {
  status: "error";
  message: string;
};

export type NatsResponse = {
  data: string;
} & (errorResponse | successResponse);

export type GetConfigResponse = {
  ethNetwork: Network;
  contractAddresses: ContractAddresses;
  nodePublicIdentifier: string;
  messaging: MessagingConfig;
};

export type GetChannelResponse = CFCoreChannel;

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
export type CreateChannelResponse = {
  transactionHash: string;
};

// TODO: why was this changed?
export type RequestCollateralResponse = CFCoreTypes.DepositResult | undefined;

////////////////////////////////////
///////// NODE API CLIENT

export interface PendingAsyncTransfer {
  assetId: string;
  amount: string;
  encryptedPreImage: string;
  linkedHash: string;
  paymentId: string;
}

export interface NodeInitializationParameters {
  messaging: IMessagingService;
  logLevel?: number;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  channelProvider?: IChannelProvider;
}

export interface INodeApiClient {
  channelProvider: IChannelProvider | undefined;
  userPublicIdentifier: string | undefined;
  nodePublicIdentifier: string | undefined;

  acquireLock(lockName: string, callback: (...args: any[]) => any, timeout: number): Promise<any>;
  appRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry>;
  config(): Promise<GetConfigResponse>;
  createChannel(): Promise<CreateChannelResponse>;
  clientCheckIn(): Promise<void>;
  getChannel(): Promise<GetChannelResponse>;
  getLatestSwapRate(from: string, to: string): Promise<string>;
  getPaymentProfile(assetId?: string): Promise<PaymentProfile>;
  getPendingAsyncTransfers(): Promise<PendingAsyncTransfer[]>;
  getTransferHistory(publicIdentifier?: string): Promise<Transfer[]>;
  getLatestWithdrawal(): Promise<Transaction>;
  requestCollateral(assetId: string): Promise<RequestCollateralResponse | void>;
  withdraw(tx: CFCoreTypes.MinimalTransaction): Promise<TransactionResponse>;
  fetchLinkedTransfer(paymentId: string): Promise<any>;
  resolveLinkedTransfer(
    paymentId: string,
    linkedHash: string,
    meta: object,
  ): Promise<ResolveLinkedTransferResponse>;
  recipientOnline(recipientPublicIdentifier: string): Promise<boolean>;
  restoreState(publicIdentifier: string): Promise<any>;
  subscribeToSwapRates(from: string, to: string, callback: any): void;
  unsubscribeFromSwapRates(from: string, to: string): void;
  // TODO: fix types
  verifyAppSequenceNumber(appSequenceNumber: number): Promise<ChannelAppSequences>;
  setRecipientAndEncryptedPreImageForLinkedTransfer(
    recipient: string,
    encryptedPreImage: string,
    linkedHash: string,
  ): Promise<any>;
}
