'use strict';
module.exports = (sequelize, DataTypes) => {
  const Comments = sequelize.define('Comments', {
    comment_id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    video_id: DataTypes.INTEGER,
    photo_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    comment: DataTypes.STRING,
    reply_to: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE
  }, {
    tableName: 'comment_master',
    underscored: true,
    paranoid: true
  });
  Comments.associate = function(models) {
    // associations can be defined here
    Comments.belongsTo(models.User, { foreignKey: 'user_id' });
    Comments.belongsTo(models.Photos, { foreignKey: 'photo_id' });
    Comments.belongsTo(models.Videos, { foreignKey: 'video_id' });
  };
  return Comments;
};