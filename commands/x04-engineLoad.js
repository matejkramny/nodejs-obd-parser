
module.exports = {
	name: 'Engine load %',
	id: '04',
	formula: function (res) {
		return res * 100 / 255
	},
	fakeResponse: function () {
		return 51; //20%
	}
}
