const debug = false;

// Define configuration options
const opts = {
  channels: ["wakandafitness", "papesan"].concat(
    debug
      ? [
          "Amouranth",
          "xQc",
          "Trymacs",
          "Gotaga",
          "zacknani",
          "KaiCenat",
          "summit1g",
          "tarik",
          "zackrawrr",
        ]
      : []
  ),
};

module.exports = opts
