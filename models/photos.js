'use strict';
module.exports = (sequelize, DataTypes) => {
  const Photos = sequelize.define('Photos', {
   id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    user_id: DataTypes.INTEGER,
    album_id: DataTypes.INTEGER,
    title: DataTypes.STRING,
    category_id: DataTypes.INTEGER,
    description: DataTypes.STRING,
    photo_thumb: DataTypes.STRING,
    photo_url: DataTypes.STRING,
    location: DataTypes.STRING,
    active: DataTypes.ENUM('Y','N'),
    total_views:DataTypes.INTEGER,
    total_earning: DataTypes.FLOAT('10','4'),
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
    total_comments:DataTypes.INTEGER,
    group_id: DataTypes.INTEGER
  }, {
    tableName: 'photo_master',
    underscored: true,
    paranoid: true
  });
  Photos.associate = function(models) {
    // associations can be defined here
     Photos.belongsTo(models.User, { foreignKey: 'album_id' });
  };
  return Photos;
};