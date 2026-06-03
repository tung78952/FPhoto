import { parseSearchInput } from '../src/shared/search'

type SearchCase = {
  input: string
  expected: number[]
}

const cases: SearchCase[] = [
  {
    input: 'EX0001, EX0005, EX0010-EX0012',
    expected: [1, 5, 10, 11, 12]
  },
  {
    input: '1',
    expected: [1]
  },
  {
    input: '0001',
    expected: [1]
  },
  {
    input: '1,2,3',
    expected: [1, 2, 3]
  },
  {
    input: '001, 004, 009',
    expected: [1, 4, 9]
  },
  {
    input: '1 2 3',
    expected: [1, 2, 3]
  },
  {
    input: 'lay anh 0001 0005 0010',
    expected: [1, 5, 10]
  },
  {
    input: 'em chọn ảnh 1, 5, từ 10 đến 12 nha',
    expected: [1, 5, 10, 11, 12]
  },
  {
    input: 'em chọn 5 tấm, gửi trước 20h, lấy ảnh 001, 004, 009',
    expected: [1, 4, 9]
  },
  {
    input: 'DSC_1234 đến DSC_1236, bỏ ảnh 1235',
    expected: [1234, 1236]
  },
  {
    input: 'ngày 12 tháng 6, lấy hình 20, 21, 22',
    expected: [20, 21, 22]
  },
  {
    input: 'sdt 0901234567, zalo 0987654321, file IMG_0007',
    expected: [7]
  },
  {
    input: 'gửi trước thứ 7 nha anh',
    expected: []
  },
  {
    input: 'em chuyển 220 rồi ạ',
    expected: []
  },
  {
    input: 'kéo chân em cao lên m8 được ko anh',
    expected: []
  },
  {
    input: 'anh chỉnh em sao từ 45 kg xuống còn 30 thôi được ko anh',
    expected: []
  },
  {
    input: 'em lấy 7 nha',
    expected: [7]
  }
]

function assertEqual(actual: number[], expected: number[], input: string): void {
  const actualText = actual.join(',')
  const expectedText = expected.join(',')

  if (actualText !== expectedText) {
    throw new Error(`Parser mismatch for "${input}". Expected [${expectedText}], got [${actualText}]`)
  }
}

for (const searchCase of cases) {
  const parsed = parseSearchInput(searchCase.input)
  assertEqual(parsed.codes, searchCase.expected, searchCase.input)
}

console.log(`Verified ${cases.length} smart search parser cases.`)
