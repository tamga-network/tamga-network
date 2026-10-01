/** Kimlik servisi tarayıcı dönüşü (`…/idv/cb`): oturumu tarayıcı yardımcısı yakalar; buraya düşülürse sekmelere dön. */
import React from "react";
import { Redirect } from "expo-router";

export default function IdvCallback() {
  return <Redirect href="/" />;
}
