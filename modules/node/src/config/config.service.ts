import { MessagingConfig } from "@connext/messaging";
import { ContractAddresses, KnownNodeAppNames } from "@connext/types";
import { OutcomeType } from "@counterfactual/types";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { getAddress, Network as EthNetwork } from "ethers/utils";

import { Network } from "../constants";

type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

type DefaultApp = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  appDefinitionAddress: string;
  name: string;
  network: Network;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const multiAssetMultiPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[][]
`;

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly envConfig: { [key: string]: string };
  private readonly ethProvider: JsonRpcProvider;
  private wallet: Wallet;

  constructor() {
    this.envConfig = process.env;
    this.ethProvider = new JsonRpcProvider(this.getEthRpcUrl());
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getEthRpcUrl(): string {
    return this.get("INDRA_ETH_RPC_URL");
  }

  getEthProvider(): JsonRpcProvider {
    return this.ethProvider;
  }

  getEthWallet(): Wallet {
    return this.wallet;
  }

  async getEthNetwork(): Promise<EthNetwork> {
    const ethNetwork = await this.getEthProvider().getNetwork();
    if (ethNetwork.name === "unknown" && ethNetwork.chainId === 4447) {
      ethNetwork.name = "ganache";
    } else if (ethNetwork.chainId === 1) {
      ethNetwork.name = "homestead";
    }
    return ethNetwork;
  }

  async getContractAddresses(): Promise<ContractAddresses> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const ethAddresses = {} as any;
    const ethAddressBook = JSON.parse(this.get("INDRA_ETH_CONTRACT_ADDRESSES"));
    Object.keys(ethAddressBook[chainId]).map((contract: string): void => {
      ethAddresses[contract] = getAddress(ethAddressBook[chainId][contract].address);
    });
    return ethAddresses as ContractAddresses;
  }

  async getTokenAddress(): Promise<string> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const ethAddressBook = JSON.parse(this.get("INDRA_ETH_CONTRACT_ADDRESSES"));
    return getAddress(ethAddressBook[chainId].Token.address);
  }

  async getDefaultApps(): Promise<DefaultApp[]> {
    const ethNetwork = await this.getEthNetwork();
    const addressBook = await this.getContractAddresses();
    return [
      {
        actionEncoding: `
          tuple(
            uint8 actionType,
            uint256 amount
          )`,
        allowNodeInstall: false,
        appDefinitionAddress: addressBook[KnownNodeAppNames.UNIDIRECTIONAL_TRANSFER],
        name: KnownNodeAppNames.UNIDIRECTIONAL_TRANSFER,
        network: Network[ethNetwork.name.toUpperCase()],
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
        stateEncoding: `
          tuple(
            uint8 stage,
            ${singleAssetTwoPartyCoinTransferEncoding} transfers,
            uint256 turnNum,
            bool finalized
          )`,
      },
      {
        allowNodeInstall: true,
        appDefinitionAddress: addressBook[KnownNodeAppNames.SIMPLE_TWO_PARTY_SWAP],
        name: KnownNodeAppNames.SIMPLE_TWO_PARTY_SWAP,
        network: Network[ethNetwork.name.toUpperCase()],
        outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
        stateEncoding: `
          tuple(
            ${multiAssetMultiPartyCoinTransferEncoding} coinTransfers
          )`,
      },
      {
        actionEncoding: `
          tuple(
            uint256 amount,
            address assetId,
            bytes32 paymentId,
            bytes32 preImage
          )`,
        allowNodeInstall: true,
        appDefinitionAddress: addressBook[KnownNodeAppNames.UNIDIRECTIONAL_LINKED_TRANSFER],
        name: KnownNodeAppNames.UNIDIRECTIONAL_LINKED_TRANSFER,
        network: Network[ethNetwork.name.toUpperCase()],
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
        stateEncoding: `
          tuple(
            uint8 stage,
            ${singleAssetTwoPartyCoinTransferEncoding} transfers,
            bytes32 linkedHash,
            uint256 turnNum,
            bool finalized
          )`,
      },
    ];
  }

  getLogLevel(): number {
    return parseInt(this.get("INDRA_LOG_LEVEL") || "3", 10);
  }

  isDevMode(): boolean {
    return this.get("NODE_ENV") !== "production";
  }

  getMnemonic(): string {
    return this.get("INDRA_ETH_MNEMONIC");
  }

  getMessagingConfig(): MessagingConfig {
    return {
      clusterId: this.get("INDRA_NATS_CLUSTER_ID"),
      logLevel: this.getLogLevel(), // <- this is very verbose just fyi
      messagingUrl: (this.get("INDRA_NATS_SERVERS") || "").split(","),
      token: this.get("INDRA_NATS_TOKEN"),
    };
  }

  getPort(): number {
    return parseInt(this.get("INDRA_PORT"), 10);
  }

  getPostgresConfig(): PostgresConfig {
    return {
      database: this.get("INDRA_PG_DATABASE"),
      host: this.get("INDRA_PG_HOST"),
      password: this.get("INDRA_PG_PASSWORD"),
      port: parseInt(this.get("INDRA_PG_PORT"), 10),
      username: this.get("INDRA_PG_USERNAME"),
    };
  }

  onModuleInit(): void {
    const wallet = Wallet.fromMnemonic(this.getMnemonic());
    this.wallet = wallet.connect(this.getEthProvider());
  }
}
