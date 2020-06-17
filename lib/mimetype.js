const MimeType = {
	mimeTypeSeq: [
		{
			mimeType: 'video/mp2p',
			lookup: Buffer.from([0x00, 0x00, 0x01, 0xBA]),
			next: [
				{
					offset: 4,
					op: '&',
					operand: 0x40,
				}
			]
		},
		{
			mimeType: 'video/mpeg',
			lookup: Buffer.from([0x00, 0x00, 0x01, 0xBA]),
			next: [
				{
					offset: 4,
					op: '^',
					operand: 0x40,
				}
			]
		},
		{
			mimeType: 'video/ogg',
			lookup: Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00]),
		},
		{
			mimeType: 'video/mpeg',
			lookup: Buffer.from([0x00, 0x00, 0x01, 0xBB]),
		},
		{
			mimeType: 'video/mp4v-es',
			lookup: Buffer.from([0x00, 0x00, 0x01, 0xB0]),
		},
		{
			mimeType: 'video/mp4v-es',
			lookup: Buffer.from([0x00, 0x00, 0x01, 0xB5]),
		},
		{
			mimeType: 'video/mp4',
			lookup: Buffer.from([0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34]),
		},
		{
			mimeType: 'video/mpv',
			lookup: Buffer.from([0x00, 0x00, 0x01, 0xB3]),
		},
		{
			mimeType: 'video/mp2t',
			lookup: Buffer.from([0x47]),
			next: [
				{
					offset: 1,
					bytes: 3,
					op: '&',
					operand: 0x5fff10,
					eq: 0x400010,
				},
			]
		},
		{
			mimeType: 'video/h264',
			lookup: Buffer.from([0x00, 0x00, 0x00, 0x01]),
			next:  [
				{
					offset: 4,
					op: '&',
					operand: 0x1F,
					eq: 0x07,
				}
			]
		},
	],

	byteOperation: function (operator, val1, val2) {

		switch (operator)
		{
			case '&': {
				return val1 & val2;
			}
			case '^': {
				return val1 ^ val2;
			}
			case '|': {
				return val1 | val2;
			}
			default: {
				return NaN;
			}
		}

	},

	getMimeType: function (buffer) {

		let result = undefined;
		const types = MimeType.mimeTypeSeq;

		for (let i = 0; i < types.length; i++)
		{
			const type = types[i];
			let startPos = 0;

			while (true)
			{
				const pos = buffer.indexOf(type.lookup, startPos);

				if (pos == -1)
				{
					break;
				}

				if (!type.next)
				{
					return type.mimeType;
				}

				startPos = pos + 1;

				let isMatch = false;

				for (let j = 0; j < type.next.length; j++)
				{
					const operation = type.next[j];

					// let value = buffer[pos + operation.offset];
					let value = buffer.readUIntBE(pos + operation.offset, operation.bytes || 1);
					value = MimeType.byteOperation(operation.op, value, operation.operand);

					if (operation.eq)
					{
						if (value === operation.eq)
						{
							isMatch = true;
							continue;
						}

						isMatch = false;
						break;
					}

					if (value)
					{
						return type.mimeType;
					}

					isMatch = false;
				}

				if (isMatch === true)
				{
					return type.mimeType;
				}

			}
		}

		return result;
	},
}

module.exports = MimeType;
