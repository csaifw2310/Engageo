// Just ignore it, Its just for migration while developement. It will be removed in production

import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import Membership from "../../src/modules/contacts/memberships/membership.model.js";
import Contact from "../../src/modules/contacts/contact/contact.model.js";

dotenv.config();

async function cleanupOrphans() {
  const contactIds = await Membership.distinct("contactId");

  if (contactIds.length === 0) {
    console.log("no memberships found");
    return;
  }

  const live = await Contact.find({ _id: { $in: contactIds } })
    .select("_id")
    .lean();
  const liveIds = new Set(live.map((c) => String(c._id)));

  const orphanIds = contactIds.filter((id) => !liveIds.has(String(id)));

  if (orphanIds.length === 0) {
    console.log(
      `checked ${contactIds.length} referenced contact(s) — no orphans`,
    );
    return;
  }

  // Report which groups are affected before touching anything, so the change
  // in each group's member count isn't a surprise.
  const affected = await Membership.aggregate([
    { $match: { contactId: { $in: orphanIds } } },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);

  console.log(
    `found ${orphanIds.length} deleted contact(s) still referenced across ${affected.length} group(s):`,
  );
  for (const a of affected) {
    console.log(`  group ${a._id}: ${a.count} orphan membership(s)`);
  }

  const result = await Membership.deleteMany({ contactId: { $in: orphanIds } });
  console.log(`\ndeleted ${result.deletedCount} orphan membership(s)`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);
  console.log("connected\n");

  await cleanupOrphans();

  await mongoose.disconnect();
  console.log("\ndone");
}

main().catch(async (err) => {
  console.error("migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});