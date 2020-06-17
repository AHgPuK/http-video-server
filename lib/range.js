module.exports = function (range, totalLength) {
	if (typeof range === 'undefined' || range === null || range.length === 0) {
		return null;
	}

	let array = range.split(/bytes=([0-9]*)-([0-9]*)/);
	let result = {
		start: parseInt(array[1]),
		end: parseInt(array[2])
	};

	if (isNaN(result.end) || result.end < 0) {
		result.end = totalLength - 1;
	}

	if (isNaN(result.start) || result.start < 0) {
		result.start = 0;
	}

	result.totalLength = totalLength;

	return result;
};
