app.directive('roomid', function ($rootScope, $stateParams, user, bunkerData) {
	return {
		scope: {
			roomId: '@roomid'
		},
		templateUrl: '/assets/app/room/room.html',
		link: function ($scope) {

			$scope.userService = user;
			$scope.$stateParams = $stateParams;

			bunkerData.$promise.then(function () {
				$scope.current = bunkerData.getRoom($scope.roomId);

				// Setup this watch once we have data
				$scope.$watch(function() { return JSON.stringify($scope.current.$members); }, function () {
					if (!$scope.current.$members) return;
					$scope.memberLookup = _.indexBy($scope.current.$members, function (roomMember) {
						return roomMember.user.id;
					});
				}, true);
			});

			$scope.now = function () {
				return moment().format('YYYY-MM-DD');
			};
			$scope.mentionUser = function (userNick) {
				$rootScope.$broadcast('inputText', '@' + userNick);
			};
			$scope.loadPreviousMessages = function () {
				return bunkerData.loadMessages($scope.current, $scope.current.$messages.length);
			};
		}
	}
});

app.filter('membersOrderBy', function () {
	return function (members) {
		return _(members)
			.sortBy(function (member) {
				return member.user.nick.toLowerCase();
			})
			.value();
	};
});
