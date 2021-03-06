var cx = require('classnames');

var Status = React.createClass({
	render() {
		var roomMember = this.props.roomMember;
		if(!roomMember) return false;

		var user = roomMember.user;
		var statusClass = cx({
			'status': true,
			'here': roomMember && user.connected && !this.away(user),
			'away': roomMember && user.connected && this.away(user)
		});

		return (
			<span className={statusClass}></span>
		)
	},

	away(user){
		return !user.present && moment().diff(moment(user.lastActivity), 'minutes') > 5;
	}

});

module.exports = Status;