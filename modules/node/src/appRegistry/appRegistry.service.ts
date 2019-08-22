import {
  AllowedSwap,
  CoinTransfer,
  KnownNodeAppNames,
  UnidirectionalLinkedTransferAppStage,
  UnidirectionalLinkedTransferAppStateBigNumber,
  UnidirectionalTransferAppStage,
  UnidirectionalTransferAppStateBigNumber,
  UnidirectionalLinkedTransferAppState,
} from "@connext/types";
import { ProposeMessage, ProposeVirtualMessage } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify, formatEther } from "ethers/utils";

import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { NodeService } from "../node/node.service";
import { SwapRateService } from "../swapRate/swapRate.service";
import { TransferService } from "../transfer/transfer.service";
import {
  bigNumberifyObj,
  CLogger,
  freeBalanceAddressFromXpub,
  normalizeEthAddresses,
} from "../util";
import { isEthAddress } from "../validator";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryService");

const ALLOWED_DISCREPANCY_PCT = 5;

@Injectable()
export class AppRegistryService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly swapRateService: SwapRateService,
    private readonly channelService: ChannelService,
    private readonly transferService: TransferService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
  ) {}

  /**
   * Validate apps that are proposed to be installed on the node by clients and
   * accept or reject the install.
   * @param data Data from CF event PROPOSE_INSTALL
   */
  async allowOrReject(
    data: ProposeMessage,
  ): Promise<NodeTypes.InstallResult | NodeTypes.RejectInstallResult> {
    try {
      await this.verifyAppProposal(data.data, data.from);
      return await this.nodeService.installApp(data.data.appInstanceId);
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting install`);
      console.error(e);
      return await this.nodeService.rejectInstallApp(data.data.appInstanceId);
    }
  }

  /**
   * Reject app installs for virtual apps that node is intermediary of
   * based on invalid conditions.
   * @param data Data from CF event PROPOSE_INSTALL_VIRTUAL
   */
  async allowOrRejectVirtual(
    data: ProposeVirtualMessage,
  ): Promise<void | NodeTypes.RejectInstallResult> {
    try {
      await this.verifyVirtualAppProposal(data.data, data.from);
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting virtual install`);
      console.error(e);
      return await this.nodeService.rejectInstallApp(data.data.appInstanceId);
    }
  }

  private async appProposalMatchesRegistry(
    proposal: NodeTypes.ProposeInstallParams,
  ): Promise<AppRegistry> {
    const registryAppInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
      proposal.appDefinition,
    );

    if (!registryAppInfo) {
      throw new Error(`App does not exist in registry for definition ${proposal.appDefinition}`);
    }

    if (
      !(
        proposal.appDefinition === registryAppInfo.appDefinitionAddress &&
        proposal.abiEncodings.actionEncoding === registryAppInfo.actionEncoding &&
        proposal.abiEncodings.stateEncoding === registryAppInfo.stateEncoding
      )
    ) {
      throw new Error(
        `Proposed app details ${JSON.stringify(proposal)} do not match registry ${JSON.stringify(
          registryAppInfo,
        )}`,
      );
    }

    return registryAppInfo;
  }

  // should validate any of the transfer-specific conditions,
  // specifically surrounding the initial state of the applications
  private async validateTransfer(params: NodeTypes.ProposeInstallParams): Promise<void> {
    // perform any validation that is relevant to both virtual
    // and ledger applications sent from a client
    const {
      initialState: initialStateBadType,
      initiatorDeposit,
      responderDeposit,
    } = normalizeEthAddresses(bigNumberifyObj(params));
    if (!responderDeposit.isZero()) {
      throw new Error(`Cannot install virtual transfer app with a nonzero responder deposit.`);
    }

    if (!initiatorDeposit.gt(Zero)) {
      throw new Error(`Cannot install a transfer app with an initiator deposit greater than zero`);
    }

    // validate the initial state is kosher
    const initialState = bigNumberifyObj(
      initialStateBadType,
    ) as UnidirectionalTransferAppStateBigNumber;
    if (!initialState.turnNum.isZero()) {
      throw new Error(`Cannot install a transfer app with a turn number > 0`);
    }

    if (initialState.finalized) {
      throw new Error(`Cannot install a transfer app with a finalized initial state`);
    }

    if (initialState.stage !== UnidirectionalTransferAppStage.POST_FUND) {
      throw new Error(
        `Cannot install a transfer app with a stage that is not the "POST_FUND" stage.`,
      );
    }

    // transfers[0] is the senders value in the array, and the transfers[1]
    // is the recipients value in the array
    if (
      bigNumberify(initialState.transfers[0].amount).lt(Zero) ||
      !bigNumberify(initialState.transfers[0].amount).eq(initiatorDeposit)
    ) {
      throw new Error(
        `Cannot install a transfer app with initiator deposit values that are ` +
          `different in the initial state than the params.`,
      );
    }

    if (!bigNumberify(initialState.transfers[1].amount).isZero()) {
      throw new Error(
        `Cannot install a transfer app with nonzero values for the recipient in the initial state.`,
      );
    }
  }

  private async validateSwap(params: NodeTypes.ProposeInstallParams): Promise<void> {
    const {
      initiatorDeposit,
      initiatorDepositTokenAddress,
      responderDeposit,
      responderDepositTokenAddress,
    } = normalizeEthAddresses(bigNumberifyObj(params));

    const validSwaps = await this.swapRateService.getValidSwaps();
    if (
      !validSwaps.find(
        (swap: AllowedSwap) =>
          swap.from === initiatorDepositTokenAddress && swap.to === responderDepositTokenAddress,
      )
    ) {
      throw new Error(
        `Swap from ${initiatorDepositTokenAddress} to ` +
          `${responderDepositTokenAddress} is not valid. Valid swaps: ${JSON.stringify(
            validSwaps,
          )}`,
      );
    }

    // |our rate - derived rate| / our rate = discrepancy
    const derivedRate =
      parseFloat(formatEther(responderDeposit)) / parseFloat(formatEther(initiatorDeposit));

    const ourRate = parseFloat(
      await this.swapRateService.getOrFetchRate(
        initiatorDepositTokenAddress,
        responderDepositTokenAddress,
      ),
    );
    const discrepancy = Math.abs(ourRate - derivedRate);
    const discrepancyPct = (discrepancy * 100) / ourRate;

    if (discrepancyPct > ALLOWED_DISCREPANCY_PCT) {
      throw new Error(
        `Derived rate is ${derivedRate.toString()}, more than ${ALLOWED_DISCREPANCY_PCT}% ` +
          `larger discrepancy than our rate of ${ourRate.toString()}`,
      );
    }

    logger.log(
      `Derived rate is ${derivedRate.toString()}, within ${ALLOWED_DISCREPANCY_PCT}% ` +
        `of our rate ${ourRate.toString()}`,
    );
  }

  // TODO: update the linked transfer app so it doesnt use a state machine
  // and instead uses a computeOutcome, similar to the swap app
  private async validateLinkedTransfer(params: NodeTypes.ProposeInstallParams): Promise<void> {
    const {
      responderDeposit,
      initiatorDeposit,
      initialState: initialStateBadType,
    } = bigNumberifyObj(params);

    if (responderDeposit.gt(Zero)) {
      throw new Error(
        `Will not accept linked transfer install where node deposit is >0 ${JSON.stringify(
          params,
        )}`,
      );
    }

    const initialState = bigNumberifyObj(
      initialStateBadType,
    ) as UnidirectionalLinkedTransferAppStateBigNumber;

    initialState.transfers = initialState.transfers.map((transfer: CoinTransfer<BigNumber>) =>
      bigNumberifyObj(transfer),
    ) as any;

    console.log("initialState: ", JSON.stringify(initialState));

    if (initialState.finalized) {
      throw new Error(`Cannot install linked transfer app with finalized state`);
    }

    if (!initialState.turnNum.isZero()) {
      throw new Error(`Cannot install a linked transfer app with nonzero turn number`);
    }

    if (initialState.stage !== UnidirectionalLinkedTransferAppStage.POST_FUND) {
      throw new Error(
        `Cannot install a linked transfer app with a stage other than the POST_FUND stage`,
      );
    }

    if (bigNumberify(initialState.transfers[0].amount).lte(Zero)) {
      throw new Error(
        `Cannot install a linked transfer app with a sender transfer of <= 0. Transfer amount: ${bigNumberify(
          initialState.transfers[0].amount,
        ).toString()}`,
      );
    }

    if (bigNumberify(initialState.transfers[1].amount).lt(Zero)) {
      throw new Error(
        `Cannot install a linked transfer app with a redeemer transfer of < 0. Transfer amount: ${bigNumberify(
          initialState.transfers[1].amount,
        ).toString()}`,
      );
    }

    if (
      !bigNumberify(initialState.transfers[0].amount).eq(initiatorDeposit) ||
      !bigNumberify(initialState.transfers[1].amount).eq(responderDeposit)
    ) {
      throw new Error(`Mismatch between deposits and initial state, refusing to install.`);
    }
  }

  private async commonAppProposalValidation(
    params: NodeTypes.ProposeInstallParams,
    initiatorIdentifier: string,
  ): Promise<void> {
    const {
      initiatorDeposit,
      initiatorDepositTokenAddress,
      responderDeposit,
      responderDepositTokenAddress,
      timeout,
      proposedToIdentifier,
    } = normalizeEthAddresses(bigNumberifyObj(params));

    if (timeout.lt(Zero)) {
      throw new Error(`"timeout" in params cannot be negative`);
    }

    if (initiatorDeposit.lt(Zero) || bigNumberify(responderDeposit).lt(Zero)) {
      throw new Error(`Cannot have negative initiator or responder deposits into applications.`);
    }

    if (responderDepositTokenAddress && !isEthAddress(responderDepositTokenAddress)) {
      throw new Error(`Invalid "responderDepositTokenAddress" provided`);
    }

    if (initiatorDepositTokenAddress && !isEthAddress(initiatorDepositTokenAddress)) {
      throw new Error(`Invalid "initiatorDepositTokenAddress" provided`);
    }

    // NOTE: may need to remove this condition if we start working
    // with games
    if (responderDeposit.isZero() && initiatorDeposit.isZero()) {
      throw new Error(
        `Cannot install an app with zero valued deposits for both initiator and responder.`,
      );
    }

    // make sure initiator has sufficient funds
    const initiatorChannel = await this.channelRepository.findByUserPublicIdentifier(
      initiatorIdentifier,
    );
    const freeBalanceInitiatorAsset = await this.nodeService.getFreeBalance(
      initiatorIdentifier,
      initiatorChannel.multisigAddress,
      initiatorDepositTokenAddress,
    );
    const initiatorFreeBalance =
      freeBalanceInitiatorAsset[freeBalanceAddressFromXpub(initiatorIdentifier)];
    if (initiatorFreeBalance.lt(initiatorDeposit)) {
      throw new Error(
        `Initiator has insufficient funds to install proposed app. Initiator free balance: ${initiatorFreeBalance.toString()}, deposit requested: ${initiatorDeposit.toString()}`,
      );
    }

    // make sure that the node has sufficient balance for requested deposit
    const nodeIsResponder = proposedToIdentifier === this.nodeService.cfNode.publicIdentifier;
    let freeBalanceResponderAsset: NodeTypes.GetFreeBalanceStateResult;
    if (nodeIsResponder) {
      freeBalanceResponderAsset = await this.nodeService.getFreeBalance(
        initiatorIdentifier,
        initiatorChannel.multisigAddress,
        responderDepositTokenAddress,
      );
    } else {
      const responderChannel = await this.channelRepository.findByUserPublicIdentifier(
        proposedToIdentifier,
      );
      freeBalanceResponderAsset = await this.nodeService.getFreeBalance(
        proposedToIdentifier,
        responderChannel.multisigAddress,
        responderDepositTokenAddress,
      );
    }
    const balAvailable =
      freeBalanceResponderAsset[freeBalanceAddressFromXpub(proposedToIdentifier)];
    if (balAvailable.lt(responderDeposit)) {
      throw new Error(`Node has insufficient balance to install the app with proposed deposit.`);
    }
  }

  // should perform validation on everything all generic app conditions that
  // must be satisfied when installing a virtual or ledger app, including:
  // - matches registry information
  // - non-negative timeout
  // - non-negative deposits
  // - valid token addresses
  // - apps have value --> maybe not for games?
  // - sufficient collateral in recipients channel (if virtual)
  // - sufficient free balance from initiator
  // - sufficient free balance from node (if ledger)

  // TODO: there is a lot of duplicate logic here + client. ideally, much
  // of this would be moved to a shared library.
  private async verifyAppProposal(
    proposedAppParams: {
      params: NodeTypes.ProposeInstallParams;
      appInstanceId: string;
    },
    initiatorIdentifier: string,
  ): Promise<void> {
    const myIdentifier = await this.nodeService.cfNode.publicIdentifier;
    if (initiatorIdentifier === myIdentifier) {
      logger.log(`Received proposal from our own node.`);
      return;
    }

    const registryAppInfo = await this.appProposalMatchesRegistry(proposedAppParams.params);

    if (!registryAppInfo.allowNodeInstall) {
      throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
    }

    await this.commonAppProposalValidation(proposedAppParams.params, initiatorIdentifier);

    switch (registryAppInfo.name) {
      case KnownNodeAppNames.SIMPLE_TWO_PARTY_SWAP:
        await this.validateSwap(proposedAppParams.params);
        break;
      case KnownNodeAppNames.UNIDIRECTIONAL_LINKED_TRANSFER:
        await this.validateLinkedTransfer(proposedAppParams.params);
        await this.transferService.saveLinkedTransfer(
          initiatorIdentifier,
          proposedAppParams.params.initiatorDepositTokenAddress,
          bigNumberify(proposedAppParams.params.initiatorDeposit),
          proposedAppParams.appInstanceId,
          (proposedAppParams.params.initialState as UnidirectionalLinkedTransferAppState)
            .linkedHash,
        );
        break;
      default:
        break;
    }
    logger.log(`Validation completed for app ${registryAppInfo.name}`);
  }

  private async verifyVirtualAppProposal(
    proposedAppParams: {
      params: NodeTypes.ProposeInstallVirtualParams;
      appInstanceId: string;
    },
    initiatorIdentifier: string,
  ): Promise<void> {
    const {
      initiatorDeposit,
      initiatorDepositTokenAddress,
      proposedToIdentifier,
    } = bigNumberifyObj(proposedAppParams.params);

    const registryAppInfo = await this.appProposalMatchesRegistry(proposedAppParams.params);

    await this.commonAppProposalValidation(proposedAppParams.params, initiatorIdentifier);

    // check if there is sufficient collateral in the channel
    const recipientChan = await this.channelRepository.findByUserPublicIdentifier(
      proposedAppParams.params.proposedToIdentifier,
    );

    const collateralFreeBal = await this.nodeService.getFreeBalance(
      proposedToIdentifier,
      recipientChan.multisigAddress,
      initiatorDepositTokenAddress,
    );

    const collateralAvailable = collateralFreeBal[this.nodeService.cfNode.freeBalanceAddress];

    if (collateralAvailable.lt(initiatorDeposit)) {
      // TODO: best way to handle case where user is sending payment
      // *above* amounts specified in the payment profile
      // also, do we want to request collateral in a different location?
      await this.channelService.requestCollateral(
        proposedToIdentifier,
        initiatorDepositTokenAddress,
        initiatorDeposit,
      );
      throw new Error(
        `Insufficient collateral detected in responders channel, ` +
          `retry after channel has been collateralized.`,
      );
    }

    switch (registryAppInfo.name) {
      case KnownNodeAppNames.UNIDIRECTIONAL_TRANSFER:
        await this.validateTransfer(proposedAppParams.params);
        // TODO: move this to install
        await this.transferService.savePeerToPeerTransfer(
          initiatorIdentifier,
          proposedAppParams.params.proposedToIdentifier,
          proposedAppParams.params.initiatorDepositTokenAddress,
          bigNumberify(proposedAppParams.params.initiatorDeposit),
          proposedAppParams.appInstanceId,
        );
        break;
      default:
        break;
    }
    logger.log(`Validation completed for app ${registryAppInfo.name}`);
  }
}
