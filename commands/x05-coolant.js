
module.exports = {
	name: 'Coolant Temperature (C)',
	id: '05',
	formula: function (res) {
		return res - 40
	},
	fakeResponse: function () {
		return 40
	}
}
