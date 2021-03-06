var uuid = require('node-uuid');
var UserActions = require('../user/userActions');
var MembershipStore = require('./membershipStore');
var SettingsStore = require('./settingsStore');

var RoomStore = Reflux.createStore({
	listenables: [UserActions],

	rooms: {},
	messageLookup: {},
	showImages: false,

	getState() {
		return {
			rooms: this.rooms
		}
	},

	init() {
		this.listenTo(MembershipStore, this.onMembershipStoreUpdate);
		io.socket.on('room', this.onRoomMessage);
		io.socket.on('user', this.onUserMessage);
		io.socket.on('roommember', this.onRoomMemberMessage);
	},

	onMembershipStoreUpdate(memberships) {
		memberships.forEach(membership => {
			io.socket.get(`/room/${membership.room.id}/join`, (room, JWR) => {
				io.socket.get(`/room/${room.id}/messages`, (messages, JWR) => {
					room.$messages = messages.reverse();
					this.decorateMessages(room.$messages);

					this.rooms[room.id] = room;
					this.messageLookup[room.id] = {};
					this.trigger(this.rooms);
				});

				io.socket.get('/roomMember', {room: room.id}, (members, JWR)=> {
					room.$members = _(members)
						.indexBy(roomMember => roomMember.user.id)
						.value();

					this.trigger(this.rooms);
				});
			});
		});
	},

	onRoomMessage(msg) {
		console.log('msg: room', msg.verb, msg.data);
		if (msg.verb == 'messaged') {
			this.addMessage(msg.id, msg.data);
		}
		this.trigger(this.rooms);
	},

	onUserMessage(msg) {
		console.log('msg: user', msg.id, msg.verb, msg.data);

		if (msg.verb == 'updated') {
			// not sure if this is right
			_.each(this.rooms, room => {
				var roomMember = room.$members[msg.id];
				if (!roomMember)return;
				_.extend(roomMember.user, msg.data);
			});
		}

		this.trigger(this.rooms);
	},

	onRoomMemberMessage(msg) {
		console.log('msg: roommember', msg.verb, msg.data);

	},

	decorateMessage(lastMessage, message) {
		message.$firstInSeries = !lastMessage || !lastMessage.author || !message.author || lastMessage.author.id != message.author.id;
		message.createdAt = moment(message.createdAt);
		message.$visible = SettingsStore.settings.showImages;
	},

	decorateMessages(messages) {
		_.each(messages, (message, index) => {
			var lastMessage = index > 0 && index < messages.length ? messages[index - 1] : null;
			this.decorateMessage(lastMessage, message);
		});
	},

	addMessage(roomId, message) {
		if (!message.id) {
			message.id = uuid.v4(); // All messages need ids
		}

		var room = this.rooms[roomId];
		if (!room) throw new Error('Received message from a room we are not a member of!');
		if (this.messageLookup[roomId][message.id]) return; // Message already exists!
		//if (!user.settings.showNotifications && !message.author) return; // User does not want to see notifications

		var lastMessage = _.last(room.$messages);
		this.decorateMessage(lastMessage, message);

		room.$messages.push(message);

		// Store messages in lookup object, this allows us to check for duplicates quickly
		this.messageLookup[roomId][message.id] = message;
	},

	// actions

	onSendMessage(roomId, message) {
		io.socket.post('/message', {"room": roomId, "text": message}, (message, JWR) => {
			if (JWR.statusCode !== 200) {
				throw new Error(JWR);
			}
		});
	},
});

module.exports = RoomStore;