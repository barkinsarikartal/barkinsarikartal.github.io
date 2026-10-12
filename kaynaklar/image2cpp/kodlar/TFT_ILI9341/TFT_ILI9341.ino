#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include "images.h"

// Classic ESP32 DevKit + SPI ILI9341 (not a parallel Uno shield).
constexpr int TFT_SCK = 18;
constexpr int TFT_MOSI = 23;
constexpr int TFT_CS = 27;
constexpr int TFT_DC = 26;
constexpr int TFT_RST = 25;
Adafruit_ILI9341 tft(&SPI, TFT_DC, TFT_CS, TFT_RST);

static_assert(sizeof(image) / sizeof(image[0]) == image_width * image_height,
              "Image size does not match RGB565 format");
static_assert(sizeof(image[0]) == 2, "Use uint16_t RGB565 output");
static_assert(image_width <= 240 && image_height <= 320, "Image too large");

void setup() {
  Serial.begin(115200);
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.begin(10000000);
  tft.setRotation(2); // Portrait: 240 x 320
  tft.fillScreen(ILI9341_BLACK);
  tft.drawRGBBitmap((tft.width() - image_width) / 2,
                    (tft.height() - image_height) / 2,
                    image, image_width, image_height);
  Serial.println("Image sent to TFT.");
}

void loop() { delay(100); }
