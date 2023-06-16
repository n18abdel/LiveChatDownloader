const tmi = require("tmi.js");
const fs = require("fs");

const opts = require("./config");

const debug = opts.debug;

const logs = Object.fromEntries(
  opts.channels.concat(debug ? ["debug"] : []).map((channel) => {
    key = `#${channel.toLowerCase()}`;
    const log = fs.createWriteStream(`${key}.log`, { flags: "a" });
    log.write(`# Starting\n`);
    return [key, log];
  })
);

// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on("connected", onConnected);
client.on("announcement", onAnnouncement);
client.on("anongiftpaidupgrade", onAnonGiftPaidUpgrade);
client.on("anonsubgift", onAnonSubGift);
client.on("anonsubmysterygift", onAnonSubMysteryGift);
client.on("ban", onPermaBan);
client.on("chat", onChat);
client.on("cheer", onCheer);
client.on("giftpaidupgrade", onGiftPaidUpgrade);
client.on("messagedeleted", onMessageDeleted);
client.on("primepaidupgrade", onPrimePaidUpgrade);
client.on("raided", onRaided);
// client.on("redeem", onRedeem);
client.on("resub", onResub);
client.on("subgift", onSubGift);
client.on("submysterygift", onSubMysteryGift);
client.on("subscription", onSubscription);
client.on("timeout", onTimeout);

// Connect to Twitch:
client.connect();

function onAnnouncement(channel, userstate, message) {
  return onUserNotice(channel, message, userstate);
}
function onAnonGiftPaidUpgrade(channel, username, userstate) {
  return onUserNotice(channel, null, userstate, username);
}
function onAnonSubGift(channel, streakMonths, recipient, methods, userstate) {
  return onUserNotice(channel, null, userstate);
}
function onAnonSubMysteryGift(channel, numbOfSubs, methods, userstate) {
  return onUserNotice(channel, null, userstate);
}
function onPermaBan(channel, username, reason, userstate) {
  userstate = { ...userstate, "msg-id": "ban" };
  return onBan(channel, username, userstate);
}
function onChat(channel, userstate, message) {
  appendLog(channel, userstate, message);
}
function onCheer(channel, userstate, message) {
  appendLog(channel, userstate, message);
}
function onGiftPaidUpgrade(channel, username, sender, userstate) {
  return onUserNotice(channel, null, userstate, username);
}
function onMessageDeleted(channel, username, deletedMessage, userstate) {
  const { body, offset } = formatBody("Deleted message:", deletedMessage);
  userstate = { ...userstate, "msg-id": "messagedeleted" };
  userstate = fillUsername(userstate, username);
  appendLog(channel, userstate, body, offset);
}
function onPrimePaidUpgrade(channel, username, methods, userstate) {
  return onUserNotice(channel, null, userstate, username);
}
function onRaided(channel, username, viewers, userstate) {
  return onUserNotice(channel, null, userstate, username);
}
// function onRedeem(channel, username, rewardtype, userstate, message) {
//   appendLog(channel, userstate, message);
// }
function onResub(channel, username, months, message, userstate) {
  return onUserNotice(channel, message, userstate, username);
}
function onSubGift(
  channel,
  username,
  streakMonths,
  recipient,
  methods,
  userstate
) {
  return onUserNotice(channel, null, userstate, username);
}
function onSubMysteryGift(channel, username, numbOfSubs, methods, userstate) {
  return onUserNotice(channel, null, userstate, username);
}
function onSubscription(channel, username, methods, message, userstate) {
  return onUserNotice(channel, message, userstate, username);
}
function onTimeout(channel, username, reason, duration, userstate) {
  userstate = { ...userstate, "msg-id": "timeout" };
  return onBan(channel, username, userstate, duration);
}

function onBan(channel, username, userstate, duration) {
  const { body, offset } = formatBody(
    "has been banned",
    duration,
    () => `for ${duration}s`
  );
  userstate = fillUsername(userstate, username);
  appendLog(channel, userstate, body, offset);
}
function onUserNotice(channel, message, userstate, username) {
  const { body, offset } = formatBody(userstate["system-msg"], message);
  userstate = fillUsername(userstate, username);
  appendLog(channel, userstate, body, offset);
}

// Utils
function optionalMessage(condition, messageFunc) {
  return (condition && messageFunc()) || "";
}
function fillUsername(userstate, username) {
  return {
    ...userstate,
    "display-name": userstate["display-name"] ?? username,
    username: userstate["username"] ?? username,
  };
}

function msgFragment(text, emote) {
  let fragment = { text };
  if (emote) fragment["emoticon"] = { emoticon_id: emote, emoticon_set_id: "" };
  return fragment;
}
function msgFragments(message, emotesPositions, offset) {
  if (!emotesPositions) return [msgFragment(message)];
  let bounds = [];
  let fragments = [];
  let emotes = {};
  for (let emote in emotesPositions) {
    const positions = emotesPositions[emote];
    positions.forEach((position) => {
      [start, end] = position.split("-").map(Number);
      emotes[start + offset] = emote;
      bounds.push(start + offset, end + offset);
    });
  }

  unicodeSplit = [...message];

  bounds
    .sort((a, b) => a - b)
    .forEach((bound, index, array) => {
      if (index == 0 && bound > 0) {
        const text = unicodeSplit.slice(0, bound).join("");
        fragments.push(msgFragment(text));
      }
      const nextBound = array[index + 1];
      if (index % 2 == 0) {
        const text = unicodeSplit.slice(bound, nextBound + 1).join("");
        const emote = emotes[bound];
        fragments.push(msgFragment(text, emote));
      } else if (bound < unicodeSplit.length - 1) {
        const text = unicodeSplit.slice(bound + 1, nextBound).join("");
        fragments.push(msgFragment(text));
      }
    });
  return fragments;
}

const actionMessageRegex = /^\u0001ACTION ([^\u0001]+)\u0001$/;
function formatEmotes(emotes) {
  if (!emotes) return;
  return Object.entries(emotes).flatMap(([emote, positions]) => {
    return positions.map((position) => {
      [begin, end] = position.split("-").map(Number);
      return { _id: emote, begin: begin, end: end };
    });
  });
}
function formatBadges(badges) {
  if (!badges) return;
  return Object.entries(badges).map(([_id, version]) => {
    return { _id, version };
  });
}
function formatBody(systemMsg, condition, messageFunc = (message) => message) {
  const msg = systemMsg ?? "";
  const optMsg = optionalMessage(condition, () => messageFunc(condition));
  let body = `${msg} ${optMsg}`;
  let offset = msg.length + 1;
  if (msg == "") {
    body = optMsg;
    offset = 0;
  }
  return { body, offset };
}
function formatMessage(userstate, body, offset = 0) {
  datestamp = new Date(Number(userstate["tmi-sent-ts"])).toISOString();
  const formattedMessage = {
    _id: userstate["id"] ?? "12345678-9012-3456-7890-100000000000",
    reply_parent_msg_id: userstate["reply-parent-msg-id"],
    created_at: datestamp,
    updated_at: datestamp,
    channel_id: userstate["room-id"] ?? "channel_id",
    content_type: "video",
    content_id: "content_id",
    content_offset_seconds: 0, //TODO
    commenter: {
      display_name: userstate["display-name"] ?? "Twitch",
      _id: userstate["user-id"],
      name: userstate["username"] ?? "Twitch",
      type: "user",
      bio: null,
      created_at: datestamp,
      updated_at: datestamp,
      logo: "",
    },
    source: "chat",
    state: "published",
    message: {
      body: body,
      bits_spent: Number(userstate.bits ?? 0),
      fragments: msgFragments(body, userstate.emotes, offset),
      is_action: Boolean(
        userstate.params && userstate.params[1].match(actionMessageRegex)
      ),
      user_badges: formatBadges(userstate.badges),
      user_color: userstate.color,
      user_notice_params: { "msg-id": userstate["msg-id"] },
      emoticons: formatEmotes(userstate.emotes),
    },
    more_replies: false,
  };
  return { datestamp, formattedMessage };
}

function stackFunctionName(frame) {
  return frame.split(" ")[5];
}
function stackLineNumber(frame) {
  return frame.split(":").reverse()[1];
}
function callerFunc(stack) {
  let frame = stack[2];
  let functionName = stackFunctionName(frame);
  if (["onUserNotice", "onBan"].includes(functionName)) {
    frame = stack[3];
    functionName = stackFunctionName(frame);
  }
  const lineNumber = stackLineNumber(frame);
  return `${functionName}/${lineNumber}`;
}

function appendLog(channel, userstate, body, offset) {
  const { datestamp, formattedMessage } = formatMessage(
    userstate,
    body,
    offset
  );
  const log = logs[channel];
  log.write(`${datestamp} ${JSON.stringify(formattedMessage)}\n`);
  if (debug) {
    const e = new Error();
    const caller = callerFunc(e.stack.split("\n"));
    const debug = logs["#debug"];
    debug.write(`${caller} ${datestamp} ${JSON.stringify(userstate)}\n`);
  }
}

// Called every time the bot connects to Twitch chat
function onConnected(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}
