'use strict';
module.exports = (sequelize, DataTypes) => {
  const Advertisement = sequelize.define('Advertisement', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    video_thumb: DataTypes.TEXT,
    video_url: DataTypes.TEXT,
    target_url: DataTypes.TEXT,
    provider_name: DataTypes.STRING,
    amount_paid: DataTypes.FLOAT(10,2),
    max_view: DataTypes.INTEGER,
    current_view: DataTypes.INTEGER,
    target_url: DataTypes.TEXT,
    target_url: DataTypes.TEXT,
    active: DataTypes.ENUM('Y','N'),
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
    skip_add: DataTypes.ENUM('Y','N'),
  }, {
    tableName: 'advertisement_master',
    underscored: true,
    paranoid: true
  });
  Advertisement.associate = function(models) {
    // associations can be defined here
  };
  return Advertisement;
};