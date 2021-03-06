import { SupportedNetwork, SupportedNetworks } from "@connext/types";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

import { OutcomeType } from "../util/cfCore";

@Entity()
export class AppRegistry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  name!: string;

  @Column("enum", {
    enum: SupportedNetworks,
  })
  network!: SupportedNetwork;

  @Column("enum", {
    enum: OutcomeType,
  })
  outcomeType!: OutcomeType;

  @Column("text")
  appDefinitionAddress!: string;

  @Column("text")
  stateEncoding!: string;

  @Column("text", { nullable: true })
  actionEncoding!: string;

  @Column("boolean", { default: false })
  allowNodeInstall!: boolean;
}
