const { userFromToken } = require("../lib/authToken");
const matchService = require("../services/matchService");

const ioRef = { io: null };

function roomName(matchId) {
  return `match:${matchId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function notifyUser(userId, event, payload) {
  if (!ioRef.io || !userId) return;
  ioRef.io.to(userRoom(userId)).emit(event, payload);
}

async function broadcastMatch(io, matchId) {
  const sockets = await io.in(roomName(matchId)).fetchSockets();
  for (const s of sockets) {
    try {
      const match = await matchService.getMatchForUser(s.user._id, matchId);
      s.emit("match_update", matchService.toClient(match, s.user._id));
    } catch (err) {
      s.emit("match_error", { error: err.message });
    }
  }
}

function attachMatchSockets(io) {
  ioRef.io = io;
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;
      const user = await userFromToken(token);
      if (!user) {
        return next(new Error("Unauthorized"));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.user._id));

    socket.on("join_match", async (matchId, cb) => {
      try {
        const match = await matchService.getMatchForUser(
          socket.user._id,
          matchId
        );
        socket.join(roomName(matchId));
        const payload = matchService.toClient(match, socket.user._id);
        if (typeof cb === "function") cb({ ok: true, match: payload });
        socket.emit("match_update", payload);
      } catch (err) {
        if (typeof cb === "function") {
          cb({ ok: false, error: err.message });
        }
      }
    });

    socket.on("match_action", async (data, cb) => {
      try {
        const { matchId, action } = data || {};
        const { payload } = await matchService.applyMatchAction(
          socket.user,
          matchId,
          action
        );
        await broadcastMatch(io, matchId);
        if (typeof cb === "function") cb({ ok: true, match: payload });
      } catch (err) {
        if (typeof cb === "function") {
          cb({ ok: false, error: err.message });
        } else {
          socket.emit("match_error", { error: err.message });
        }
      }
    });
  });
}

module.exports = { attachMatchSockets, broadcastMatch, roomName, notifyUser };
