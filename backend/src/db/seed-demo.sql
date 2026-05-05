/*
  Demo seed for Kids Rental project
  - Inserts categories
  - Inserts 6 equipment rows
  - Inserts images for each equipment
*/

-- Categories
IF NOT EXISTS (SELECT 1 FROM Categories WHERE Slug = 'bounce-houses')
  INSERT INTO Categories (Name, Slug, IsActive) VALUES ('Bounce Houses', 'bounce-houses', 1);

IF NOT EXISTS (SELECT 1 FROM Categories WHERE Slug = 'combo-units')
  INSERT INTO Categories (Name, Slug, IsActive) VALUES ('Combo Units', 'combo-units', 1);

IF NOT EXISTS (SELECT 1 FROM Categories WHERE Slug = 'water-slides')
  INSERT INTO Categories (Name, Slug, IsActive) VALUES ('Water Slides', 'water-slides', 1);

IF NOT EXISTS (SELECT 1 FROM Categories WHERE Slug = 'concessions')
  INSERT INTO Categories (Name, Slug, IsActive) VALUES ('Concessions', 'concessions', 1);

DECLARE @BounceCategoryId INT = (SELECT TOP 1 Id FROM Categories WHERE Slug = 'bounce-houses');
DECLARE @ComboCategoryId INT = (SELECT TOP 1 Id FROM Categories WHERE Slug = 'combo-units');
DECLARE @WaterCategoryId INT = (SELECT TOP 1 Id FROM Categories WHERE Slug = 'water-slides');
DECLARE @ConcessionCategoryId INT = (SELECT TOP 1 Id FROM Categories WHERE Slug = 'concessions');

-- 1) Castle Bounce
IF NOT EXISTS (SELECT 1 FROM Equipment WHERE Slug = 'castle-bounce-15x15')
BEGIN
  INSERT INTO Equipment (CategoryId, Name, Slug, Description, PricePerRental, TotalQuantity, IsActive, IsFeatured)
  VALUES (@BounceCategoryId, 'Castle Bounce 15x15', 'castle-bounce-15x15', 'Large classic castle bounce house for birthdays and events.', 300.00, 4, 1, 1);
END

-- 2) Princess Castle Bounce
IF NOT EXISTS (SELECT 1 FROM Equipment WHERE Slug = 'princess-castle-bounce-15x15')
BEGIN
  INSERT INTO Equipment (CategoryId, Name, Slug, Description, PricePerRental, TotalQuantity, IsActive, IsFeatured)
  VALUES (@BounceCategoryId, 'Princess Castle Bounce 15x15', 'princess-castle-bounce-15x15', 'Pink and purple castle bounce unit for princess-themed parties.', 300.00, 3, 1, 1);
END

-- 3) Sports Arena Bounce
IF NOT EXISTS (SELECT 1 FROM Equipment WHERE Slug = 'sports-arena-bounce-15x15')
BEGIN
  INSERT INTO Equipment (CategoryId, Name, Slug, Description, PricePerRental, TotalQuantity, IsActive, IsFeatured)
  VALUES (@BounceCategoryId, 'Sports Arena Bounce 15x15', 'sports-arena-bounce-15x15', 'Sports-themed bounce with basketball hoop and bright graphics.', 300.00, 3, 1, 0);
END

-- 4) Fun House Combo
IF NOT EXISTS (SELECT 1 FROM Equipment WHERE Slug = 'fun-house-combo')
BEGIN
  INSERT INTO Equipment (CategoryId, Name, Slug, Description, PricePerRental, TotalQuantity, IsActive, IsFeatured)
  VALUES (@ComboCategoryId, 'Fun House Combo', 'fun-house-combo', 'Combo with climbing, jumping, basketball and slide.', 375.00, 2, 1, 1);
END

-- 5) 15ft Water Slide
IF NOT EXISTS (SELECT 1 FROM Equipment WHERE Slug = '15ft-water-slide')
BEGIN
  INSERT INTO Equipment (CategoryId, Name, Slug, Description, PricePerRental, TotalQuantity, IsActive, IsFeatured)
  VALUES (@WaterCategoryId, '15ft Water Slide', '15ft-water-slide', 'Refreshing single-lane water slide for summer parties.', 400.00, 2, 1, 1);
END

-- 6) Snow Cone Machine
IF NOT EXISTS (SELECT 1 FROM Equipment WHERE Slug = 'snow-cone-machine')
BEGIN
  INSERT INTO Equipment (CategoryId, Name, Slug, Description, PricePerRental, TotalQuantity, IsActive, IsFeatured)
  VALUES (@ConcessionCategoryId, 'Snow Cone Machine', 'snow-cone-machine', 'Easy-to-use snow cone machine; perfect party concession add-on.', 90.00, 5, 1, 0);
END

-- Equipment images (safe insert)
DECLARE @Eq1 INT = (SELECT TOP 1 Id FROM Equipment WHERE Slug = 'castle-bounce-15x15');
DECLARE @Eq2 INT = (SELECT TOP 1 Id FROM Equipment WHERE Slug = 'princess-castle-bounce-15x15');
DECLARE @Eq3 INT = (SELECT TOP 1 Id FROM Equipment WHERE Slug = 'sports-arena-bounce-15x15');
DECLARE @Eq4 INT = (SELECT TOP 1 Id FROM Equipment WHERE Slug = 'fun-house-combo');
DECLARE @Eq5 INT = (SELECT TOP 1 Id FROM Equipment WHERE Slug = '15ft-water-slide');
DECLARE @Eq6 INT = (SELECT TOP 1 Id FROM Equipment WHERE Slug = 'snow-cone-machine');

IF @Eq1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EquipmentImages WHERE EquipmentId = @Eq1)
  INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder) VALUES (@Eq1, 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1400&q=80', 0);

IF @Eq2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EquipmentImages WHERE EquipmentId = @Eq2)
  INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder) VALUES (@Eq2, 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1400&q=80', 0);

IF @Eq3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EquipmentImages WHERE EquipmentId = @Eq3)
  INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder) VALUES (@Eq3, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1400&q=80', 0);

IF @Eq4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EquipmentImages WHERE EquipmentId = @Eq4)
  INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder) VALUES (@Eq4, 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1400&q=80', 0);

IF @Eq5 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EquipmentImages WHERE EquipmentId = @Eq5)
  INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder) VALUES (@Eq5, 'https://images.unsplash.com/photo-1503453363465-fd9d11f93a35?auto=format&fit=crop&w=1400&q=80', 0);

IF @Eq6 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EquipmentImages WHERE EquipmentId = @Eq6)
  INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder) VALUES (@Eq6, 'https://images.unsplash.com/photo-1524429656589-6633a470097c?auto=format&fit=crop&w=1400&q=80', 0);

-- Default admin user (login at /admin/login) — bcrypt hash for Admin123!
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'admin@kidsrental.local')
  INSERT INTO Users (Name, Email, Phone, PasswordHash, IsAdmin, IsActive)
  VALUES (
    'Demo Admin',
    'admin@kidsrental.local',
    NULL,
    N'$2a$10$QgPrSD7Y.m3QBt0ltA5TlOpx4pVGAfLway/Ff5aBgoKJ1hucgcrCm',
    1,
    1
  );

UPDATE Users
SET PasswordHash = N'$2a$10$QgPrSD7Y.m3QBt0ltA5TlOpx4pVGAfLway/Ff5aBgoKJ1hucgcrCm',
    IsAdmin = 1,
    IsActive = 1,
    UpdatedAt = SYSUTCDATETIME()
WHERE Email = 'admin@kidsrental.local';

-- Ensure PayLater column exists (safe re-run)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Orders') AND name = N'PayLater'
)
BEGIN
  ALTER TABLE dbo.Orders ADD PayLater BIT NOT NULL CONSTRAINT DF_Orders_PayLater_Seed DEFAULT (0);
END

-- Optional: quick check
SELECT TOP 20 e.Id, e.Name, e.PricePerRental, e.TotalQuantity, c.Name AS CategoryName
FROM Equipment e
LEFT JOIN Categories c ON c.Id = e.CategoryId
ORDER BY e.CreatedAt DESC;
