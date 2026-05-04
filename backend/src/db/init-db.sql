/*
  Run this first in SQL Server to create database.
*/
IF DB_ID('RentalDb') IS NULL
BEGIN
  CREATE DATABASE RentalDb;
END;
GO

USE RentalDb;
GO
