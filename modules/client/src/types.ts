import { JsonRpcProvider } from "ethers/providers";
import {
  AppRegistry,
  Contract,
  GetConfigResponse,
  IChannelProvider,
  ILoggerService,
  MessagingService,
  INodeApiClient,
  KeyGen,
  Network,
  Store,
} from "@connext/types";

// This type is only ever used inside the client,
// No need to keep it in the global types package.
export type InternalClientOptions = {
  appRegistry: AppRegistry;
  channelProvider: IChannelProvider;
  config: GetConfigResponse;
  ethProvider: JsonRpcProvider;
  keyGen: KeyGen;
  logger: ILoggerService;
  messaging: IMessagingService;
  network: Network;
  node: INodeApiClient;
  store: Store;
  token: Contract;
  xpub: string;
};

export {
  Address,
  App,
  AppActionBigNumber,
  AppInstanceInfo,
  AppInstanceJson,
  AppRegistry,
  AppStateBigNumber,
  BigNumber,
  calculateExchange,
  CFChannelProviderOptions,
  CFCoreChannel,
  CFCoreTypes,
  ChannelAppSequences,
  ChannelProviderConfig,
  ChannelProviderRpcMethod,
  ChannelState,
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
  ClientOptions,
  CoinBalanceRefundAppState,
  CoinBalanceRefundAppStateBigNumber,
  CoinTransferBigNumber,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  ConnextClientStorePrefix,
  ConnextEvent,
  ConnextEventEmitter,
  ConnextEvents,
  ConnextRpcMethod,
  ConnextRpcMethods,
  convert,
  CreateChannelMessage,
  CreateChannelResponse,
  DefaultApp,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositParameters,
  DepositStartedMessage,
  fromWei,
  GetChannelResponse,
  GetConfigResponse,
  IChannelProvider,
  IConnextClient,
  INodeApiClient,
  InstallMessage,
  InstallVirtualMessage,
  inverse,
  IRpcConnection,
  isBN,
  IStoreService,
  JsonRpcRequest,
  KeyGen,
  LINKED_TRANSFER_TO_RECIPIENT,
  LinkedTransferParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
  makeChecksum,
  makeChecksumOrEthAddress,
  MatchAppInstanceResponse,
  maxBN,
  minBN,
  NodeInitializationParameters,
  NodeMessageWrappedProtocolMessage,
  RebalanceProfile,
  PendingAsyncTransfer,
  ProposeMessage,
  ProtocolTypes,
  RejectInstallVirtualMessage,
  RejectProposalMessage,
  RequestCollateralResponse,
  RequestDepositRightsParameters,
  RequestDepositRightsResponse,
  RescindDepositRightsParameters,
  RescindDepositRightsResponse,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  ResolveLinkedTransferToRecipientParameters,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleSwapAppState,
  SimpleSwapAppStateBigNumber,
  SimpleTransferAppState,
  SimpleTransferAppStateBigNumber,
  StateChannelJSON,
  Store,
  StorePair,
  SupportedApplication,
  SupportedApplications,
  SwapParameters,
  toBN,
  tokenToWei,
  toWei,
  Transfer,
  TransferCondition,
  TransferParameters,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  weiToToken,
  WithdrawalResponse,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawParameters,
  WithdrawStartedMessage,
} from "@connext/types";
