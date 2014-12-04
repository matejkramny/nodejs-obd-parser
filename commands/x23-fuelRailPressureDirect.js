
module.exports = {
	name: 'Fuel Rail Pressure (diesel, or gasoline direct inject)',
	id: '23',
	formula: function (res) {
		return res * 10
	},
	fakeResponse: function () {
		return 40
	}
}
