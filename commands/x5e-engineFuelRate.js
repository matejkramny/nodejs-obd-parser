
module.exports = {
	name: 'Engine Fuel Rate (L/hr)',
	id: '5E',
	formula: function (res) {
		return res * 0.05
	},
	fakeResponse: function () {
		return 40
	}
}
