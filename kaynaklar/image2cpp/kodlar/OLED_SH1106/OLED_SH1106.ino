#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include "images.h"

// Classic Arduino Nano (ATmega328P): SDA = A4, SCL = A5.
constexpr uint8_t OLED_ADDRESS = 0x3C;
Adafruit_SH1106G display(128, 64, &Wire, -1);

static_assert(sizeof(image) == image_width * ((image_height + 7) / 8),
              "Image size does not match vertical-page MONO format");
static_assert(image_width <= 128 && image_height <= 64, "Image too large");

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.beginTransmission(OLED_ADDRESS);
  if (Wire.endTransmission() != 0) {
    Serial.println(F("OLED not found at 0x3C. Check wiring/address."));
    while (true) delay(1000);
  }
  if (!display.begin(OLED_ADDRESS, true)) {
    Serial.println(F("SH1106 initialization failed."));
    while (true) delay(1000);
  }
  display.clearDisplay();
  const int x0 = (128 - image_width) / 2;
  const int y0 = (64 - image_height) / 2;
  // image2cpp.com MONO: page-major, one byte = 8 vertical pixels, LSB at top.
  for (int y = 0; y < image_height; ++y) {
    for (int x = 0; x < image_width; ++x) {
      uint8_t value = pgm_read_byte(&image[(y / 8) * image_width + x]);
      if (value & (1u << (y % 8))) {
        display.drawPixel(x0 + x, y0 + y, SH110X_WHITE);
      }
    }
  }
  display.display();
  Serial.println(F("Image displayed."));
}

void loop() { delay(100); }
