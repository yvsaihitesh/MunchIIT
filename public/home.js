const cart = {};
const cards = document.getElementsByClassName("CardBox")
const search = document.getElementById("search")
const glassIcon = document.getElementById("glass");
const navText = document.querySelectorAll("nav-text");

search.addEventListener('input', () => {
    Array.from(cards).forEach(card => {
        const itemName = card.querySelector(".card-title").innerText.toLowerCase().replace(/\s+/g, '');
        if (!itemName.includes(search.value.toLowerCase().replace(/\s+/g, ''))) {
            card.style.display = 'none';
        } else {
            card.style.display = 'block';
        }
    });
});

function addToCart(id) {
    document.getElementById(`cart-controls-${id}`).style.display = "flex";
    document.getElementById(`add-to-cart-${id}`).style.display = "none";
    cart[id] = 1;
    updateCartCount();
}

async function addToCartRequest(itemId) {
    try {
        const response = await fetch(`/cart/add/${itemId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        if (result.success) {
            alert('Item added to cart!');
        } else {
            alert(result.message || 'Failed to add item to cart.');
        }
    } catch (error) {
        console.error('Error adding item to cart:', error);
        alert('Failed to add item to cart.');
    }
}


// function updateCart(id, quantity) {
//     cart[id] = (cart[id] || 0) + quantity;
//     if (cart[id] <= 0) {
//         delete cart[id];
//         document.getElementById(`add-to-cart-${id}`).style.display = "block";
//         document.getElementById(`cart-controls-${id}`).style.display = "none";
//     } else {
//         document.getElementById(`item-count-${id}`).innerText = cart[id];
//     }
//     updateCartCount();
// }

async function updateCart(itemId, change) {
    try {
        const response = await fetch(`/cart/update/${itemId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ change }),
        });
        const result = await response.json();
        if (result.success) {
            // Update the count display
            const countDisplay = document.getElementById(`item-count-${itemId}`);
            if (countDisplay) countDisplay.textContent = result.quantity;
        } else {
            alert(result.message || 'Failed to update cart.');
        }
    } catch (error) {
        console.error('Error updating cart:', error);
        alert('Failed to update cart.');
    }
}


function updateCartCount() {
    const totalCount = Object.values(cart).reduce((sum, count) => sum + count, 0);
    if (totalCount <= 0) {
        document.getElementById("cartBadge").style.display = "none";
    }
    else {
        document.getElementById("cartBadge").style.display = "block";
        document.getElementById("cartBadge").innerText = totalCount;
    }
}

// Function to decrease quantity
function decreaseQuantity(itemId, currentQuantity) {
    if (currentQuantity > 1) {  // Make sure quantity doesn't go below 1
        fetch(`/cart/decrease/${itemId}`, {
            method: 'POST',  // POST request to update quantity
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity: currentQuantity - 1 })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();  // Reload the page to show updated cart
            } else {
                alert('Error updating quantity');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred.');
        });
    } else {
        alert('Quantity cannot be less than 1');
    }
}