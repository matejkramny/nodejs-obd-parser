
module.exports = {
	name: 'Relative Throttle Position',
	id: '45',
	formula: function (res) {
		return res * 100 / 255
	},
	fakeResponse: function () {
		return 40
	}
}
