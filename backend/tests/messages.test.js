const { app, request, createVerifiedUser, authed, createGroupWith } = require("./helpers");

/**
 * Group chat. Membership is the whole permission model, and polling depends on
 * `since` returning only what is genuinely new.
 */

let alice;
let bob;
let outsider;
let groupId;

beforeEach(async () => {
  alice = await createVerifiedUser({ name: "Alice", email: "alice@example.com" });
  bob = await createVerifiedUser({ name: "Bob", email: "bob@example.com" });
  outsider = await createVerifiedUser({ name: "Mallory", email: "mallory@example.com" });

  groupId = await createGroupWith(alice.token, "Trip", [bob]);
});

const send = (token, text) =>
  request(app).post(`/api/messages/${groupId}`).set(authed(token)).send({ text });

const list = (token, query = "") =>
  request(app).get(`/api/messages/${groupId}${query}`).set(authed(token));

describe("sending", () => {
  it("stores a message and returns it with its sender", async () => {
    const res = await send(alice.token, "Who paid for dinner?").expect(201);

    expect(res.body.message.text).toBe("Who paid for dinner?");
    expect(res.body.message.sender.name).toBe("Alice");
    expect(res.body.message.sender).not.toHaveProperty("password");
  });

  it("trims surrounding whitespace", async () => {
    const res = await send(alice.token, "   padded   ").expect(201);
    expect(res.body.message.text).toBe("padded");
  });

  it("refuses an empty message", async () => {
    await send(alice.token, "").expect(400);
    await send(alice.token, "     ").expect(400);
  });

  it("refuses a message over the length limit", async () => {
    const res = await send(alice.token, "x".repeat(2001)).expect(400);
    expect(res.body.msg).toMatch(/2000/);
  });

  it("refuses someone who is not in the group", async () => {
    await send(outsider.token, "let me in").expect(403);
  });

  it("refuses an unauthenticated request", async () => {
    await request(app).post(`/api/messages/${groupId}`).send({ text: "hi" }).expect(401);
  });
});

describe("reading", () => {
  it("returns messages oldest first", async () => {
    await send(alice.token, "first").expect(201);
    await send(bob.token, "second").expect(201);
    await send(alice.token, "third").expect(201);

    const res = await list(alice.token).expect(200);
    expect(res.body.messages.map((m) => m.text)).toEqual(["first", "second", "third"]);
  });

  it("shows both members the same conversation", async () => {
    await send(alice.token, "hello").expect(201);

    const forBob = await list(bob.token).expect(200);
    expect(forBob.body.messages).toHaveLength(1);
    expect(forBob.body.messages[0].sender.name).toBe("Alice");
  });

  it("starts empty", async () => {
    const res = await list(alice.token).expect(200);
    expect(res.body.messages).toEqual([]);
  });

  it("refuses someone who is not in the group", async () => {
    await list(outsider.token).expect(403);
  });

  it("404s an unknown group", async () => {
    await request(app)
      .get("/api/messages/64b7f1c2a1b2c3d4e5f60718")
      .set(authed(alice.token))
      .expect(404);
  });
});

describe("polling with since", () => {
  it("returns only messages newer than the timestamp", async () => {
    const first = await send(alice.token, "old").expect(201);

    const res = await list(alice.token, `?since=${first.body.message.createdAt}`).expect(200);
    expect(res.body.messages).toEqual([]);

    await send(bob.token, "new").expect(201);

    const after = await list(alice.token, `?since=${first.body.message.createdAt}`).expect(200);
    expect(after.body.messages.map((m) => m.text)).toEqual(["new"]);
  });

  it("ignores an unparseable timestamp rather than returning nothing", async () => {
    await send(alice.token, "hello").expect(201);

    const res = await list(alice.token, "?since=not-a-date").expect(200);
    expect(res.body.messages).toHaveLength(1);
  });
});

describe("unread indicator", () => {
  const unread = (token) =>
    request(app).get(`/api/messages/${groupId}/unread`).set(authed(token));
  const markRead = (token) =>
    request(app).post(`/api/messages/${groupId}/read`).set(authed(token));

  it("starts at zero on an empty group", async () => {
    const res = await unread(alice.token).expect(200);
    expect(res.body.count).toBe(0);
  });

  it("counts a message from someone else", async () => {
    await send(alice.token, "dinner was 900").expect(201);

    const res = await unread(bob.token).expect(200);
    expect(res.body.count).toBe(1);
  });

  it("does not count your own messages", async () => {
    await send(alice.token, "one").expect(201);
    await send(alice.token, "two").expect(201);

    const res = await unread(alice.token).expect(200);
    expect(res.body.count).toBe(0);
  });

  it("clears once the reader marks the chat read", async () => {
    await send(alice.token, "hello").expect(201);
    expect((await unread(bob.token).expect(200)).body.count).toBe(1);

    await markRead(bob.token).expect(200);

    expect((await unread(bob.token).expect(200)).body.count).toBe(0);
  });

  it("counts only what arrived after the last read", async () => {
    await send(alice.token, "before").expect(201);
    await markRead(bob.token).expect(200);

    await send(alice.token, "after one").expect(201);
    await send(alice.token, "after two").expect(201);

    expect((await unread(bob.token).expect(200)).body.count).toBe(2);
  });

  it("tracks each member separately", async () => {
    await send(alice.token, "hello both").expect(201);
    await markRead(bob.token).expect(200);

    expect((await unread(bob.token).expect(200)).body.count).toBe(0);

    // Carol joins later and has read nothing, so the backlog is unread for her.
    const carol = await createVerifiedUser({ name: "Carol", email: "carol@example.com" });
    await request(app)
      .post("/api/groups/add-member")
      .set(authed(alice.token))
      .send({ groupId, email: carol.email })
      .expect(200);

    expect((await unread(carol.token).expect(200)).body.count).toBe(1);
  });

  it("refuses someone who is not in the group", async () => {
    await unread(outsider.token).expect(403);
    await markRead(outsider.token).expect(403);
  });

  it("refuses unauthenticated requests", async () => {
    await request(app).get(`/api/messages/${groupId}/unread`).expect(401);
    await request(app).post(`/api/messages/${groupId}/read`).expect(401);
  });
});
