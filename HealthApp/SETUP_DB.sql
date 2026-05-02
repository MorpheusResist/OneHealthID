-- Run this after your main schema to add supporting tables:
CREATE TABLE IF NOT EXISTS UPLOADS (
  upload_id    INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  doc_type     VARCHAR(100) DEFAULT 'Other',
  doc_date     DATE,
  notes        TEXT,
  file_url     VARCHAR(500),
  uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

-- Sample data to populate dashboards (replace user_id as needed):
INSERT IGNORE INTO WEARABLE_DATA (user_id,steps,sleep_hours,heart_rate,record_date) VALUES
(1,8400,7.2,64,'2024-12-01'),(1,9200,6.8,67,'2024-12-02'),(1,11000,8.1,61,'2024-12-03'),
(1,7800,6.5,70,'2024-12-04'),(1,10500,7.8,63,'2024-12-05'),(1,6200,5.9,74,'2024-12-06'),(1,9800,7.5,65,'2024-12-07');

INSERT IGNORE INTO WORKOUT (user_id,workout_type,duration_minutes,calories_burned,workout_date) VALUES
(1,'Running',45,420,'2024-12-01'),(1,'Weight Training',60,380,'2024-12-03'),
(1,'Cycling',50,460,'2024-12-05'),(1,'HIIT',30,350,'2024-12-07'),
(1,'Running',40,390,'2024-11-28'),(1,'Yoga',60,180,'2024-11-25');

INSERT IGNORE INTO MEDICATION (user_id,medication_name,dosage,start_date,end_date) VALUES
(1,'Metformin 500mg','500mg twice daily','2024-11-01','2025-02-28'),
(1,'Vitamin D3','2000 IU daily','2024-10-01','2025-03-31');
