const pngToIco = require('png-to-ico');
const fs = require('fs');

pngToIco('banana_crawler.png')
  .then(buf => {
    fs.writeFileSync('build/icon.ico', buf);
    console.log('Icon generated successfully!');
  })
  .catch(console.error);
