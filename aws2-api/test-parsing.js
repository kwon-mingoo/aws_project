// 파일명 파싱 로직 테스트
function parseFilenameDatePath(filename) {
  console.log(`Testing filename: ${filename}`);
  
  // 파일명 패턴: YYYYMMDDHHMM_raw.json
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})_raw\.json$/);
  
  if (!match) {
    console.log('No match found');
    return null;
  }
  
  const [, year, month, day, hour, minute] = match;
  const path = `rawdata/${year}/${month}/${day}/${hour}/${filename}`;
  
  console.log(`Parsed: year=${year}, month=${month}, day=${day}, hour=${hour}, minute=${minute}`);
  console.log(`Generated path: ${path}`);
  
  return path;
}

// 테스트 케이스들
const testFiles = [
  '202508081441_raw.json',
  '202508081234_raw.json',
  '202512312359_raw.json',
  'invalid_file.json'
];

testFiles.forEach(file => {
  console.log('\n' + '='.repeat(50));
  parseFilenameDatePath(file);
});