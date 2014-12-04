
module.exports = {
	name: 'Intake Air Temperature (C)',
	id: '0F',
	formula: function (res) {
		return res - 40
	},
	fakeResponse: function () {
		return 40
	}
}
