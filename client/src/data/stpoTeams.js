/**
 * STPO team roster — the fixed list of students shown on the separate
 * "STPO" admin page.
 *
 * Fee figures are NOT stored here: the page reads the live tuition/hostel/mess
 * totals from the database by roll number, so this file only holds the
 * STPO-specific grouping, level and contact numbers.
 *
 * Class ID: 25KTAIDH
 */
export const STPO_CLASS_ID = '25KTAIDH';

export const STPO_TEAMS = [
  {
    team: '25KTAIDH_7',
    members: [
      { rollNumber: '25B21A45E0', name: 'PAMPANA HEMANTH SAI', level: 'L1', studentPhone: '9346552679', parentPhone: '8500901357' },
      { rollNumber: '25B21A45B5', name: 'SANNAMURI SIVA SAI HARSHITHA', level: 'L2', studentPhone: '9959962759', parentPhone: '9701408264' },
      { rollNumber: '25B21A4578', name: 'KAROTHU KARUN KUMAR', level: 'L3', studentPhone: '8523857149', parentPhone: '9440801319' },
      { rollNumber: '25B21A45A5', name: 'RAPAKA MEGHANA', level: 'L4', studentPhone: '6305716877', parentPhone: '9347255171' },
    ],
  },
  {
    team: '25KTAIDH_8',
    members: [
      { rollNumber: '25B21A4591', name: 'DASARI SAI SHIVA KANTH', level: 'L1', studentPhone: '9346609281', parentPhone: '6304706719' },
      { rollNumber: '25B21A45B4', name: 'GUNJI BHAGYASRI NAGALAKSHMI', level: 'L2', studentPhone: '8096629040', parentPhone: '9703025478' },
      { rollNumber: '25B21A45B0', name: 'IPPILI SATYANARAYANA', level: 'L3', studentPhone: '6304204975', parentPhone: '8985017759' },
      { rollNumber: '25B21A45D4', name: 'GANDETI SOWJANYA', level: 'L4', studentPhone: '6309978835', parentPhone: '8465044369' },
    ],
  },
  {
    team: '25KTAIDH_11',
    members: [
      { rollNumber: '25B21A4589', name: 'PENUMAKA ANIL KUMAR', level: '-', studentPhone: '7386967258', parentPhone: '9666853384' },
      { rollNumber: '25B21A4590', name: 'SWAYAMPAKULA VENKATA SAI SURYA TEJA', level: 'L1', studentPhone: '8555822453', parentPhone: '8919699404' },
      { rollNumber: '25B21A45C8', name: 'VAVILAPALLI GNANA SARASWATHI', level: 'L2', studentPhone: '8293906553', parentPhone: '8637506553' },
      { rollNumber: '25B21A45A8', name: 'NAGIDI SIRI VENNELA', level: 'L4', studentPhone: '6300293102', parentPhone: '8247651218' },
    ],
  },
  {
    team: '25KTAIDH_18',
    members: [
      { rollNumber: '25B21A4597', name: 'MAGANTI PRABHAKAR', level: 'L1', studentPhone: '9121499961', parentPhone: '9704275749' },
      { rollNumber: '25B21A45C4', name: 'VEDULLAPALLI NISHITHA', level: 'L2', studentPhone: '8179298586', parentPhone: '8297655638' },
      { rollNumber: '25B21A4598', name: 'INAPARTHI MOSES', level: 'L3', studentPhone: '8885300157', parentPhone: '8106014682' },
      { rollNumber: '25B21A45E2', name: 'TAMARAPALLI MANASA', level: 'L4', studentPhone: '9912352641', parentPhone: '8639157756' },
      { rollNumber: '25B21A45E8', name: 'TADI BHAGYA SUJITH NARAYANA', level: 'L5', studentPhone: '9676353314', parentPhone: '9866353314' },
    ],
  },
  {
    // NOTE: team number to confirm with the admin — the source list labelled
    // this group 25KTAIDH_18 as well.
    team: '25KTAIDH_18',
    members: [
      { rollNumber: '25B21A45A1', name: 'GOLLAMANDALA SHALINI', level: '-', studentPhone: '7815872900', parentPhone: '7993568678' },
      { rollNumber: '25B21A45C2', name: 'CHENNAM MOUNIKA DEVI', level: 'L1', studentPhone: '9381276828', parentPhone: '7989659389' },
      { rollNumber: '25B21A45B6', name: 'BURADAPATI KARTHIKEYE', level: 'L2', studentPhone: '8143850890', parentPhone: '9676555488' },
      { rollNumber: '25B21A4588', name: 'GANGUBOINA ROHITH DORA', level: 'L4', studentPhone: '8247073483', parentPhone: '8688084047' },
      { rollNumber: '25B21A45D5', name: 'PALLELA LAKSHMAN', level: 'L5', studentPhone: '8125001817', parentPhone: '9440709769' },
    ],
  },
];
