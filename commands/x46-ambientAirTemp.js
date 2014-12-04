
module.exports = {
	name: 'Ambient Air Temperature (C)',
	id: '46',
	formula: function (res) {
		return res - 40
	},
	fakeResponse: function () {
		return 40
	}
}
