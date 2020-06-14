'use strict';
module.exports = (sequelize, DataTypes) => {
  const Album = sequelize.define('Album', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    user_id: DataTypes.INTEGER,
    album_name: DataTypes.STRING,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE
  }, {
    tableName: 'album_master',
    underscored: true,
    paranoid: true
  });
  Album.associate = function(models) {
    // associations can be defined here
     Album.belongsTo(models.User, { foreignKey: 'user_id' });
     Album.hasMany(models.Photos, { foreignKey: 'album_id' , as : 'photos'});

    // Album.hasMany(models.Photos, {as : 'photos', foreignKey : 'album_id'});

  };
  return Album;
};