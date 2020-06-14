'use strict';
module.exports = (sequelize, DataTypes) => {
  const States = sequelize.define('States', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    state_name: DataTypes.STRING,
    state_code: DataTypes.STRING,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE
  }, {
    tableName: 'state_master',
    underscored: true,
    paranoid: true
  });
  States.associate = function(models) {
    // associations can be defined here
  };
  return States;
};