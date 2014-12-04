
module.exports = {
	name: 'Actual Engine Torque (%)',
	id: '62',
	formula: function (res) {
		return res - 125
	},
	fakeResponse: function () {
		return 40
	}
}
