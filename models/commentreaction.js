'use strict';
module.exports = (sequelize, DataTypes) => {
  const CommentReaction = sequelize.define('CommentReaction', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    user_id: DataTypes.INTEGER,
    comment_id: DataTypes.INTEGER,
    type: DataTypes.BOOLEAN,
    reacted_at: DataTypes.DATE,
    reacted_at: DataTypes.DATE,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE
  }, {
    tableName: 'comment_reaction_master',
    underscored: true,
    paranoid: true
  });
  CommentReaction.associate = function(models) {
    // associations can be defined here
  };
  return CommentReaction;
};