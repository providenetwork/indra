import { utils } from "@connext/client";
import { IConnextClient } from "@connext/types";
import { BigNumber } from "ethers/utils";
import { AddressZero, Zero } from "ethers/constants";
import * as lolex from "lolex";
import {
  cleanupMessaging,
  ClientTestMessagingInputOpts,
  createClient,
  createClientWithMessagingLimits,
  delay,
  ETH_AMOUNT_SM,
  ethProvider,
  expect,
  FORBIDDEN_SUBJECT_ERROR,
  fundChannel,
  getOpts,
  getProtocolFromData,
  getStore,
  MesssagingEventData,
  RECEIVED,
  SEND,
  SUBJECT_FORBIDDEN,
  TestMessagingService,
  withdrawFromChannel,
  ZERO_ZERO_ZERO_FIVE_ETH,
} from "../util";

const { withdrawalKey } = utils;

describe("Withdraw offline tests", () => {
  let clock: any;
  let client: IConnextClient;

  /////////////////////////////////
  /// TEST SPECIFIC HELPERS

  const createAndFundChannel = async (
    messagingConfig: Partial<ClientTestMessagingInputOpts> = {},
    amount: BigNumber = ETH_AMOUNT_SM,
    assetId: string = AddressZero,
  ): Promise<IConnextClient> => {
    // make sure the tokenAddress is set
    const client = await createClientWithMessagingLimits(messagingConfig);
    await fundChannel(client, amount, assetId);
    return client;
  };

  beforeEach(async () => {
    // create the clock
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  it("client proposes withdrawal but doesn't receive a response from node", async () => {
    client = await createAndFundChannel({
      ceiling: { received: 0 },
      protocol: "withdraw",
    });

    (client.messaging as TestMessagingService).on(RECEIVED, (msg: MesssagingEventData) => {
      if (getProtocolFromData(msg) === "withdraw") {
        clock.tick(89_000);
      }
    });

    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
    ).to.be.rejectedWith(`timed out after 90s waiting for counterparty reply in withdraw`);
  });

  it("client proposes withdrawal and then goes offline before node responds", async () => {
    client = await createAndFundChannel({
      ceiling: { sent: 1 },
      protocol: "withdraw",
    });

    let eventCount = 0;
    (client.messaging as TestMessagingService).on(SEND, async (msg: MesssagingEventData) => {
      eventCount += 1;
      if (getProtocolFromData(msg) === "withdraw" && eventCount === 1) {
        // wait for message to be sent (happens after event thrown)
        await delay(500);
        clock.tick(89_000);
      }
    });

    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
    ).to.be.rejectedWith(`timed out after 90s waiting for counterparty reply in withdraw`);
  });

  it("client proposes a node submitted withdrawal but node is offline for one message (commitment should be written to store and retried)", async () => {
    client = await createAndFundChannel({
      forbiddenSubjects: ["channel.withdraw"],
    });

    (client.messaging as TestMessagingService).on(SUBJECT_FORBIDDEN, () => {
      clock.tick(89_000);
    });
    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
    ).to.be.rejectedWith(FORBIDDEN_SUBJECT_ERROR);

    // make sure withdrawal is in the store
    const store = getStore(client.publicIdentifier);
    const { tx, retry } = await store.get(withdrawalKey(client.publicIdentifier));
    expect(tx).to.be.ok;
    expect(tx.to).to.be.equal(client.multisigAddress);
    expect(tx.value).equal(Zero); // amt transferred in internal tx
    expect(retry).to.be.equal(0);

    // restart the client
    const { mnemonic } = getOpts(client.publicIdentifier);
    const reconnected = await createClient({ mnemonic, store });
    expect(reconnected.publicIdentifier).to.be.equal(client.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(client.multisigAddress);
    expect(reconnected.freeBalanceAddress).to.be.equal(client.freeBalanceAddress);

    await new Promise((resolve: Function) => {
      ethProvider.once(client.multisigAddress, async () => {
        resolve();
      });
    });

    // make sure the withdrawal has been handled
    const resubmitted = await store.get(withdrawalKey(client.publicIdentifier));
    expect(resubmitted).to.not.be.ok;
  });

  afterEach(async () => {
    await cleanupMessaging();
    if (clock) {
      clock.reset();
    }
  });
});
