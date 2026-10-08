// just ignore it, Its just for migration while developement. It will be removed in production

import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import Message from "../../src/modules/message/message.model.js";
import Contact from "../../src/modules/contacts/contact/contact.model.js";
import Conversation from "../../src/modules/conversation/conversation.model.js";

dotenv.config();

const INDEX_NAME = "campaignId_1_contactId_1";

async function rebuildIndex() {
  const collection = Message.collection;
  const indexes = await collection.indexes();
  const existing = indexes.find((i) => i.name === INDEX_NAME);

  const filter = existing?.partialFilterExpression;
  const alreadyCorrect =
    !!filter &&
    !("conversationId" in filter) &&
    filter.campaignId?.$type === "objectId";

  if (alreadyCorrect) {
    console.log(`[1/2] index ${INDEX_NAME} already correct — skipping`);
    return;
  }

  if (existing) {
    console.log(`[1/2] dropping stale index ${INDEX_NAME}`);
    await collection.dropIndex(INDEX_NAME);
  }

  console.log(`[1/2] creating ${INDEX_NAME} with a supported partial filter`);
  await collection.createIndex(
    { campaignId: 1, contactId: 1 },
    {
      name: INDEX_NAME,
      unique: true,
      // $ne is NOT valid here — MongoDB rejects it with CannotCreateIndex.
      // $type: "objectId" matches "present and not null" and is supported.
      partialFilterExpression: {
        campaignId: { $type: "objectId" },
        contactId: { $type: "objectId" },
      },
    },
  );
}

async function backfillConversations() {
  const orphans = await Message.find({
    campaignId: { $ne: null },
    contactId: { $ne: null },
    conversationId: null,
  })
    .select("_id userId contactId whatsappConnectionId content sentAt createdAt")
    .lean();

  if (orphans.length === 0) {
    console.log("[2/2] no campaign messages need linking");
    return;
  }

  console.log(`[2/2] linking ${orphans.length} campaign message(s)`);

  // Resolve every referenced contact once rather than per message.
  const contactIds = [...new Set(orphans.map((m) => String(m.contactId)))];
  const contacts = await Contact.find({ _id: { $in: contactIds } })
    .select("_id userId name phoneNumber")
    .lean();
  const contactById = new Map(contacts.map((c) => [String(c._id), c]));

  let linked = 0;
  let skipped = 0;

  for (const msg of orphans) {
    const contact = contactById.get(String(msg.contactId));

    // Contact deleted since the campaign ran — there's no phone number to key
    // a conversation on, so leave the message unlinked rather than guess.
    if (!contact) {
      skipped += 1;
      continue;
    }

    const conversation = await Conversation.findOneAndUpdate(
      { userId: msg.userId, phoneNumber: contact.phoneNumber },
      {
        $setOnInsert: {
          userId: msg.userId,
          phoneNumber: contact.phoneNumber,
          whatsappConnectionId: msg.whatsappConnectionId,
          contactId: contact._id,
          displayName: contact.name || contact.phoneNumber,
          lastMessage: (msg.content ?? "").slice(0, 100),
          lastMessageAt: msg.sentAt ?? msg.createdAt,
          lastMessageDirection: "outbound",
        },
      },
      { upsert: true, new: true },
    ).lean();

    await Message.updateOne(
      { _id: msg._id },
      { $set: { conversationId: conversation._id } },
    );

    linked += 1;
  }

  console.log(`[2/2] linked ${linked}, skipped ${skipped} (contact deleted)`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);
  console.log("connected\n");

  await rebuildIndex();
  await backfillConversations();

  await mongoose.disconnect();
  console.log("\ndone");
}

main().catch(async (err) => {
  console.error("migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});