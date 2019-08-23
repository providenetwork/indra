import { Address, Node as NodeTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";

import { UnidirectionalLinkedTransferAppState } from "./app";
import { AssetAmount } from "./node";

/////////////////////////////////
///////// SWAP
export type AllowedSwap = {
  from: string;
  to: string;
};

export type SwapRate = AllowedSwap & {
  rate: string;
};

/////////////////////////////////
///////// CLIENT INPUT TYPES

////// Deposit types
// TODO: we should have a way to deposit multiple things
export type DepositParameters<T = string> = Omit<AssetAmount<T>, "assetId"> & {
  assetId?: Address; // if not supplied, assume it is eth
};
export type DepositParametersBigNumber = DepositParameters<BigNumber>;

////// Transfer types
// TODO: would we ever want to pay people in the same app with multiple currencies?
export type TransferParameters<T = string> = DepositParameters<T> & {
  recipient: Address;
  meta?: any; // TODO: meta types? should this be a string
};
export type TransferParametersBigNumber = TransferParameters<BigNumber>;

////// Swap types
// TODO: would we ever want to pay people in the same app with multiple currencies?
export interface SwapParameters<T = string> {
  amount: T;
  swapRate: string;
  toAssetId: Address;
  fromAssetId: Address;
  // make sure they are consistent with CF stuffs
}
export type SwapParametersBigNumber = SwapParameters<BigNumber>;

////// Withdraw types
export type WithdrawParameters<T = string> = DepositParameters<T> & {
  userSubmitted?: boolean;
  recipient?: Address; // if not provided, will default to signer addr
};
export type WithdrawParametersBigNumber = WithdrawParameters<BigNumber>;

///// Resolve condition types

// linked transfer
export type ResolveLinkedTransferParameters<T = string> = LinkedTransferParameters<T> & {
  paymentId: string;
  preImage: string;
};
export type ResolveLinkedTransferResponse = {
  freeBalance: NodeTypes.GetFreeBalanceStateResult;
  paymentId: string;
};

// resolver union types
// FIXME: should be union type of all supported conditions
export type ResolveConditionParameters<T = string> = ResolveLinkedTransferParameters;

// FIXME: should be union type of all supported conditions
export type ResolveConditionResponse<T = string> = ResolveLinkedTransferResponse;

///// Conditional transfer types

// TODO: maybe not an enum?
export const TransferConditions = {
  LINKED_TRANSFER: "LINKED_TRANSFER",
};
export type TransferCondition = keyof typeof TransferConditions;

// linked transfer types
export type LinkedTransferParameters<T = string> = {
  conditionType: "LINKED_TRANSFER";
  amount: T;
  assetId: Address; // make optional?
};
export type LinkedTransferParametersBigNumber = LinkedTransferParameters<BigNumber>;

export type LinkedTransferResponse = {
  paymentId: string;
  preImage: string;
  freeBalance: NodeTypes.GetFreeBalanceStateResult;
};

// FIXME: should be union type of all supported conditions
export type ConditionalTransferParameters<T = string> = LinkedTransferParameters<T>;
export type ConditionalTransferParametersBigNumber = ConditionalTransferParameters<BigNumber>;

// FIXME: should be union type of all supported conditions
export type ConditionalTransferResponse = LinkedTransferResponse;

// condition initial states
// FIXME: should be union type of all supported conditions
export type ConditionalTransferInitialState<T = string> = UnidirectionalLinkedTransferAppState<T>;
// FIXME: should be union type of all supported conditions
export type ConditionalTransferInitialStateBigNumber = ConditionalTransferInitialState<BigNumber>;
