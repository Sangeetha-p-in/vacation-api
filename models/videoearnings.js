'use strict';
module.exports = (sequelize, DataTypes) => {
  const videoEarnings = sequelize.define('videoEarnings', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    video_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    contributer_name: DataTypes.STRING,
    contributer_email: DataTypes.STRING,
    amount: DataTypes.STRING,
    note: DataTypes.STRING,
    charge_object: DataTypes.TEXT,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE
  }, {
    tableName: 'video_earnings',
    underscored: true,
    paranoid: true
  });
  videoEarnings.associate = function(models) {
    // associations can be defined here
  };
  return videoEarnings;
};