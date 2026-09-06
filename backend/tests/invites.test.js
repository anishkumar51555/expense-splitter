const { app, request, createVerifiedUser, authed } = require("./helpers");
const Group = require("../src/models/Group");

/**
 * Invite links are how most people join a group, so the code has to survive a
 * round trip: generated on create, accepted once, harmless when clicked twice.
 */

let owner;
let friend;
let groupId;
let code;

beforeEach(async () => {
  owner = await createVerifiedUser({ name: "Owner", email: "owner@example.com" });
  friend = await createVerifiedUser({ name: "Friend", email: "friend@example.com" });

  const res = await request(app)
    .post("/api/groups/create")
    .set(authed(owner.token))
    .send({ name: "Trip" })
    .expect(200);

  groupId = res.body._id;
  code = (await Group.findById(groupId)).inviteCode;
});

describe("invite codes", () => {
  it("gives every new group a code", async () => {
    expect(code).toMatch(/^[0-9a-f]{8}$/);
  });

  it("gives two groups different codes", async () => {
    const other = await request(app)
      .post("/api/groups/create")
      .set(authed(owner.token))
      .send({ name: "Flat" })
      .expect(200);

    const otherCode = (await Group.findById(other.body._id)).inviteCode;
    expect(otherCode).not.toBe(code);
  });
});

describe("joining by invite", () => {
  it("adds someone who follows the link", async () => {
    const res = await request(app)
      .get(`/api/groups/join/${code}`)
      .set(authed(friend.token))
      .expect(200);

    expect(res.body.msg).toMatch(/joined/i);

    const group = await Group.findById(groupId);
    expect(group.members.map(String)).toContain(friend.id);
  });

  it("lets the joiner then read the group", async () => {
    await request(app).get(`/api/groups/join/${code}`).set(authed(friend.token)).expect(200);

    const res = await request(app)
      .get(`/api/groups/${groupId}`)
      .set(authed(friend.token))
      .expect(200);

    expect(res.body.group.name).toBe("Trip");
  });

  it("is harmless when the same person clicks twice", async () => {
    await request(app).get(`/api/groups/join/${code}`).set(authed(friend.token)).expect(200);
    const again = await request(app)
      .get(`/api/groups/join/${code}`)
      .set(authed(friend.token))
      .expect(200);

    expect(again.body.msg).toMatch(/already a member/i);

    const group = await Group.findById(groupId);
    const mine = group.members.filter((m) => m.toString() === friend.id);
    expect(mine).toHaveLength(1);
  });

  it("does not duplicate the owner who is already in the group", async () => {
    await request(app).get(`/api/groups/join/${code}`).set(authed(owner.token)).expect(200);

    const group = await Group.findById(groupId);
    const mine = group.members.filter((m) => m.toString() === owner.id);
    expect(mine).toHaveLength(1);
  });

  it("rejects a code that does not exist", async () => {
    const res = await request(app)
      .get("/api/groups/join/deadbeef")
      .set(authed(friend.token))
      .expect(404);

    expect(res.body.msg).toMatch(/invalid invite/i);
  });

  it("refuses an unauthenticated request", async () => {
    await request(app).get(`/api/groups/join/${code}`).expect(401);
  });
});
