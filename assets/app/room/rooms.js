app.factory('rooms', function ($q, $rootScope, bunkerApi, user, uuid) {
	var rooms = {};
	var messageLookup = {};

	// Retrieve room from cache or request it from server
	// TODO this function as the join currently
	function getRoom(roomId) {

		if (!rooms[roomId]) {
			rooms[roomId] = bunkerApi.room.get({id: roomId}, function () {
				loadMessages(roomId);
				rooms[roomId].$members = bunkerApi.roomMember.query({room: roomId});
			});
			rooms[roomId].$messages = [];
			rooms[roomId].$members = [];
		}

		return rooms[roomId];
	}

	function loadMessages(roomId) {
		if (!rooms[roomId]) {
			throw 'Cannot load previous messages of an unknown room; fetch room first';
		}

		var deferred = $q.defer();
		var skipAmount = rooms[roomId].$messages.length;

		bunkerApi.room.messages({roomId: roomId, skip: skipAmount}, function (messages) {
			_(messages).each(function (message) {
				addMessage(roomId, message);
			});

			rooms[roomId].$messages = _.sortBy(rooms[roomId].$messages, 'createdAt'); // Resort messages
			decorateMessages(rooms[roomId].$messages);
			deferred.resolve();
		});

		return deferred.promise;
	}

	function joinRoom() {
		// TODO not in use, retrieval causes join
	}

	function leaveRoom(roomId) {
		// TODO need to retrieve before leaving? me thinks not
		var room = getRoom(roomId);
		room.$promise.then(function () {
			room.$leave(function () {
				delete rooms[roomId];
			});
		});
	}

	// Add a message
	function addMessage(roomId, message) {

		if (!message.id) {
			message.id = uuid.v4(); // All messages need ids
		}

		if (messageLookup[message.id]) return; // Message already exists!
		if (!user.settings.showNotifications && !message.author) return; // User does not want to see notifications

		var room = getRoom(roomId);
		var lastMessage = _.last(room.$messages);
		message.$firstInSeries = !lastMessage || !lastMessage.author || !message.author || lastMessage.author.id != message.author.id;

		room.$messages.push(message);
		messageLookup[message.id] = message.id; // Store messages in lookup object, this allows us to check for duplicates quickly
	}

	function decorateMessages(messages) {
		_.each(messages, function (message, index) {
			var lastMessage = index > 0 && index < messages.length ? messages[index - 1] : null;
			message.$firstInSeries = !lastMessage || !lastMessage.author || !message.author || lastMessage.author.id != message.author.id;
		});
	}

	// Edit a message
	function editMessage(roomId, message) {
		var room = getRoom(roomId);
		var currentMessage = _.find(room.$messages, {id: message.id});
		if (currentMessage) {
			angular.extend(currentMessage, message);
		}
	}

	// Handle incoming messages
	$rootScope.$on('$sailsResourceMessaged', function (evt, resource) {
		if (resource.model != 'room') return;

		if (!resource.data.edited) {
			addMessage(resource.id, resource.data);
		}
		else {
			editMessage(resource.id, resource.data)
		}
	});

	var disconnectMessages = [];

	// Handle disconnect
	$rootScope.$on('$sailsDisconnected', function () {
		_.each(rooms, function (room) {
			var message = {text: 'Disconnected', createdAt: new Date().toISOString()};
			disconnectMessages.push(message);
			addMessage(room.id, message);
		});
	});

	$rootScope.$on('$sailsConnected', function () {
		if (!disconnectMessages.length)return;
		_.each(disconnectMessages, function (message) {
			message.text = 'Connected';
		});
		disconnectMessages = [];
	});

	// Watch for socket.io updates to users
	// Apply changes to our list of users, if they are in this room
	$rootScope.$on('$sailsResourceUpdated', function (evt, resource) {
		if (resource.model == 'user') {
			_(rooms).flatten('$members').where({'user': {id: resource.id}}).each(function (roomMember) {
				angular.extend(roomMember.user, resource.data);
			});
		}
	});

	return {
		get: getRoom,
		loadMessages: loadMessages,
		join: joinRoom,
		leave: leaveRoom
	};
});
