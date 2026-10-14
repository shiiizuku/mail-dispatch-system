// Writes out/sample-envelopes.pdf and out/calibration.pdf for a test print.
// Run: npm run build -w @mds/envelope && node scripts/print-sample.mjs
import { writeFileSync } from 'node:fs';
import { renderCalibrationPage, renderEnvelopes } from '@mds/envelope';

const envelopes = [
  {
    controlNo: 'MGB-10-681',
    service: 'REGISTERED',
    recipient: {
      name: 'ATTY. DENNIS A. QUINTERO',
      position: 'Partner',
      company: 'Quisumbing Torres',
      addressLines: [
        '12/F ONE / NEO Building',
        '26th Street Corner 3rd Avenue,',
        'Crescent Park West, BGC,',
        'Taguig City, 1634',
      ],
    },
  },
  {
    controlNo: 'MGB-10-000',
    service: 'ORDINARY',
    recipient: {
      name: 'SAMPLE: A VERY LONG COMPANY ADDRESSEE NAME TO TEST WRAPPING',
      position: 'President and Chief Executive Officer',
      company: 'Sample Mining and Development Corporation',
      addressLines: ['Unit 1234, Sample Tower, 1234 Sample Avenue', 'Brgy. Sample, City of San Fernando', 'Pampanga, 2000'],
    },
  },
];

writeFileSync('out/sample-envelopes.pdf', await renderEnvelopes(envelopes));
writeFileSync('out/calibration.pdf', await renderCalibrationPage());
console.log('wrote out/sample-envelopes.pdf and out/calibration.pdf');
