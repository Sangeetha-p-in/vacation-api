'use strict';
module.exports = (sequelize, DataTypes) => {
  const Videos = sequelize.define('Videos', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    title: DataTypes.STRING,
    category_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    description: DataTypes.STRING,
    video_thumb: DataTypes.STRING,
    video_url: DataTypes.STRING,
    location: DataTypes.STRING,
    total_earning: DataTypes.FLOAT(10,4),
    total_views: DataTypes.INTEGER,
    active: DataTypes.ENUM('Y','N'),
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
    total_comments:DataTypes.INTEGER,
    group_id: DataTypes.INTEGER
  }, {
    tableName: 'video_master',
    underscored: true,
    paranoid: true
  });
  Videos.associate = function(models) {
    // associations can be defined here
        Videos.belongsTo(models.User, { foreignKey: 'user_id' });

  };
  return Videos;
};