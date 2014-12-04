
module.exports = {
	name: 'Engine Oil Temperature (C)',
	id: '5C',
	formula: function (res) {
		return res - 40
	},
	fakeResponse: function () {
		return 40
	}
}
