# Order Logic Functional Flow and Computation

This document explains the intended Food and Beverage order total calculation flow and the current implemented backend behavior.

## Auditable Computation Flow

Always calculate in this order:

1. Item base amount  
   `unit_price * quantity`

2. Item-level taxes  
   Taxes attached directly to that menu item.

3. Item total  
   `item_base_amount + item_level_taxes`

4. Repeat for every ordered item.

5. Order subtotal  
   Sum of all item totals.

6. Order-level charges and taxes  
   Examples: service charge, convenience fee, delivery fee, packaging fee, resort fee, or additional order taxes.

7. Order total before discount  
   `order_subtotal + order_level_charges`

8. Discounts  
   Examples: percentage discount, fixed discount, coupon, loyalty redemption.

9. Net payable amount  
   `order_total_before_discount - discounts`

10. Rounding rule, when enabled  
   Examples: nearest `0.05`, `0.10`, or whole number.

11. Grand total  
   Final amount the guest or customer pays.

## Example

```text
Burger (Rs 200 x 2)
  Item base: Rs 400
  GST 5%: Rs 20
  VAT 2%: Rs 8
  Item total: Rs 428

Pizza (Rs 500 x 1)
  Item base: Rs 500
  GST 5%: Rs 25
  Item total: Rs 525

Order subtotal: Rs 953

Order-level charges:
  Service charge 10%: Rs 95.30
  Delivery fee: Rs 50
  Packaging fee: Rs 20

Total before discount: Rs 1,118.30
Coupon discount: Rs 100
Net payable: Rs 1,018.30
Rounded grand total: Rs 1,018
```

## Current Backend Implementation

Current code path: `backend/app/services/restaurant_service.py`.

Today the system supports:

- Unit price and quantity per order line.
- Item-level tax assignment from menu item tax configs.
- Fallback food tax configs when an item has no direct tax config.
- Percentage taxes.
- Fixed taxes.
- Staff-created orders.
- Guest portal orders.
- Order edits that recalculate totals when lines change.

Current persisted fields:

- `RestaurantOrderItem.unit_price`
- `RestaurantOrderItem.quantity`
- `RestaurantOrderItem.item_total`
- `RestaurantOrder.subtotal`
- `RestaurantOrder.tax`
- `RestaurantOrder.total`

Important current behavior:

- `item_total` currently stores the item base amount only: `unit_price * quantity`.
- `subtotal` currently stores the sum of item base amounts before tax.
- `tax` stores calculated item taxes, unless an explicit tax amount is sent.
- `total` stores `subtotal + tax`.
- Order-level service charges, delivery fees, discounts, coupons, loyalty redemption, and rounding are not yet persisted as separate fields.

## Recommended Next Data Model Extension

To fully support the auditable flow above, add explicit order adjustment records instead of hiding them inside one tax or total field.

Recommended table concept:

```text
restaurant_order_adjustments
  id
  hotel_id
  order_id
  adjustment_type
    service_charge
    delivery_fee
    packaging_fee
    resort_fee
    order_tax
    discount
    coupon
    loyalty
    rounding
  calculation_type
    percentage
    fixed
  value
  amount
  taxable
  display_name
  created_at
```

Recommended final order fields:

```text
items_base_total
item_tax_total
item_gross_total
order_charge_total
discount_total
rounding_adjustment
grand_total
```

This keeps invoices, tax reporting, accounting, and future government tax calculations consistent and traceable.
